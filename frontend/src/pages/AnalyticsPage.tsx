import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/services/analyticsService'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import LoadingSpinner from '@/components/LoadingSpinner'
import EnterpriseChartTooltip from '@/components/EnterpriseChartTooltip'
import { BarChart3, PieChart as PieIcon, Briefcase } from 'lucide-react'

// Restrained functional colors for enterprise risk analytics
const RISK_COLORS: Record<string, string> = {
  HIGH: '#DC2626',
  MEDIUM: '#D97706',
  LOW: '#16A34A',
}

// ── Reusable Enterprise Chart Legend ──────────────────────────────────────────

function EnterpriseChartLegend() {
  return (
    <div className="flex items-center justify-center gap-5 text-xs text-[#666666] pt-3 border-t border-[#E5E5E5] mt-3">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
        <span className="font-medium text-[#666666]">High Risk</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#D97706]" />
        <span className="font-medium text-[#666666]">Medium Risk</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
        <span className="font-medium text-[#666666]">Low Risk</span>
      </div>
    </div>
  )
}

// ── Main Analytics Page ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: overview, isLoading: ov } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: analyticsService.getAnalyticsOverview,
  })
  const { data: dept, isLoading: deptLoading } = useQuery({
    queryKey: ['analytics-dept'],
    queryFn: analyticsService.getDepartmentAnalytics,
  })
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['analytics-role'],
    queryFn: analyticsService.getJobRoleAnalytics,
  })

  const pieData = overview?.risk_distribution
    ? Object.entries(overview.risk_distribution).map(([k, v]) => ({
        name: k.toUpperCase(),
        value: v,
      }))
    : []

  const totalRiskEmployees = pieData.reduce((sum, item) => sum + item.value, 0)
  const deptData = dept?.departments || []
  const roleData = role?.job_roles || []

  return (
    <div className="space-y-8">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#111111] tracking-tight leading-tight">
          HR Attrition Analytics
        </h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1">
          Aggregated organizational attrition risk metrics generated from prediction records.
        </p>
      </div>

      {/* ── Top Row: Risk Distribution + Overtime Impact ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Overall Risk Distribution (Donut Chart) */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-[#E5E5E5] pb-2.5">
              <PieIcon className="w-4 h-4 text-[#111111]" />
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
                Overall Risk Tier Distribution
              </h3>
            </div>

            {ov ? (
              <div className="py-20 flex justify-center"><LoadingSpinner /></div>
            ) : pieData.length === 0 ? (
              <div className="py-16 text-center text-[#8A8A8A] text-xs">
                No prediction records available. Score employees to view distributions.
              </div>
            ) : (
              <div className="w-full">
                {/* Donut container with centered total */}
                <div className="relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={95}
                        paddingAngle={2}
                        animationDuration={200}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={RISK_COLORS[entry.name] || '#111111'}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <EnterpriseChartTooltip type="donut" totalCount={totalRiskEmployees} />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Total Label inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
                      TOTAL
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-[#111111] font-mono leading-tight">
                      {totalRiskEmployees.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Donut Legend with counts and percentages */}
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 text-xs border-t border-[#E5E5E5] mt-2">
                  {pieData.map((item) => {
                    const normName = item.name.toUpperCase()
                    const color = RISK_COLORS[normName] || '#111111'
                    const pct =
                      totalRiskEmployees > 0
                        ? ((item.value / totalRiskEmployees) * 100).toFixed(1)
                        : '0'
                    return (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[#666666] font-medium">
                          {item.name === 'HIGH' ? 'High' : item.name === 'MEDIUM' ? 'Medium' : 'Low'}:
                        </span>
                        <span className="font-semibold text-[#111111] font-mono">
                          {item.value.toLocaleString()}
                        </span>
                        <span className="text-[#8A8A8A] text-[11px]">({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Overtime Status Risk Comparison */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-[#E5E5E5] pb-2.5">
              <Briefcase className="w-4 h-4 text-[#111111]" />
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
                Overtime Status Risk Comparison
              </h3>
            </div>

            {ov ? (
              <div className="py-20 flex justify-center"><LoadingSpinner /></div>
            ) : !overview?.overtime_risk || Object.keys(overview.overtime_risk).length === 0 ? (
              <div className="py-16 text-center text-[#8A8A8A] text-xs">
                No overtime risk data available.
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {Object.entries(overview.overtime_risk).map(([ot, prob]) => {
                  const percent = (prob as number) * 100
                  const isHigh = ot.toLowerCase() === 'yes'
                  const barColor = isHigh ? 'bg-[#DC2626]' : 'bg-[#16A34A]'
                  const textColor = isHigh ? 'text-[#DC2626]' : 'text-[#16A34A]'

                  return (
                    <div key={ot} className="space-y-2 p-3 bg-[#F7F7F7] rounded-lg border border-[#E5E5E5]">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-semibold text-[#111111]">
                          Overtime: <span className="uppercase">{ot}</span>
                        </span>
                        <span className={`font-bold font-mono ${textColor}`}>
                          {percent.toFixed(1)}% Avg Risk
                        </span>
                      </div>

                      {/* Thin clean progress track */}
                      <div className="h-2 bg-[#F2F2F2] rounded-full overflow-hidden border border-[#E5E5E5]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-[#8A8A8A] leading-relaxed">
                        {isHigh
                          ? 'Consistently elevates attrition probability in model feature analysis'
                          : 'Associated with reduced baseline attrition tendency'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Departmental Risk Distribution (Grouped Bar Chart) ─────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-[#E5E5E5] pb-2.5">
          <BarChart3 className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
            Departmental Risk Distribution
          </h3>
        </div>

        {deptLoading ? (
          <div className="py-20 flex justify-center"><LoadingSpinner /></div>
        ) : deptData.length === 0 ? (
          <p className="text-xs text-[#8A8A8A] text-center py-12">
            No departmental prediction data recorded yet.
          </p>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={deptData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                barGap={4}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#DCDCDC' }}
                  tickLine={{ stroke: '#E5E5E5' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#DCDCDC' }}
                  tickLine={{ stroke: '#E5E5E5' }}
                />
                <Tooltip content={<EnterpriseChartTooltip type="department" />} />
                <Bar
                  dataKey="HIGH"
                  fill={RISK_COLORS.HIGH}
                  name="High Risk"
                  radius={[3, 3, 0, 0]}
                  animationDuration={200}
                />
                <Bar
                  dataKey="MEDIUM"
                  fill={RISK_COLORS.MEDIUM}
                  name="Medium Risk"
                  radius={[3, 3, 0, 0]}
                  animationDuration={200}
                />
                <Bar
                  dataKey="LOW"
                  fill={RISK_COLORS.LOW}
                  name="Low Risk"
                  radius={[3, 3, 0, 0]}
                  animationDuration={200}
                />
              </BarChart>
            </ResponsiveContainer>
            <EnterpriseChartLegend />
          </div>
        )}
      </div>

      {/* ── 4. Job Role Attrition Chart (Horizontal Stacked Bar Chart) ────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-[#E5E5E5] pb-2.5">
          <BarChart3 className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
            Attrition Count by Job Role
          </h3>
        </div>

        {roleLoading ? (
          <div className="py-20 flex justify-center"><LoadingSpinner /></div>
        ) : roleData.length === 0 ? (
          <p className="text-xs text-[#8A8A8A] text-center py-12">
            No job role prediction data recorded yet.
          </p>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={Math.max(400, roleData.length * 44)}>
              <BarChart
                data={roleData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                barSize={16}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#DCDCDC' }}
                  tickLine={{ stroke: '#E5E5E5' }}
                />
                <YAxis
                  dataKey="job_role"
                  type="category"
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#DCDCDC' }}
                  tickLine={{ stroke: '#E5E5E5' }}
                  width={200}
                />
                <Tooltip content={<EnterpriseChartTooltip type="role" />} />
                <Bar
                  dataKey="HIGH"
                  fill={RISK_COLORS.HIGH}
                  name="High Risk"
                  stackId="a"
                  animationDuration={200}
                />
                <Bar
                  dataKey="MEDIUM"
                  fill={RISK_COLORS.MEDIUM}
                  name="Medium Risk"
                  stackId="a"
                  animationDuration={200}
                />
                <Bar
                  dataKey="LOW"
                  fill={RISK_COLORS.LOW}
                  name="Low Risk"
                  stackId="a"
                  radius={[0, 3, 3, 0]}
                  animationDuration={200}
                />
              </BarChart>
            </ResponsiveContainer>
            <EnterpriseChartLegend />
          </div>
        )}
      </div>
    </div>
  )
}

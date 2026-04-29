'use client'

import { ComplianceBar, PassFailTrend } from '@/components/charts/Charts'

interface ComplianceItem { name: string; compliance: number; total: number }
interface TrendPoint { month: string; passed: number; failed: number }

export default function HrQualityCharts({
  deptCompliance,
  trend,
  complianceRate,
}: {
  deptCompliance: ComplianceItem[]
  trend: TrendPoint[]
  complianceRate: number
}) {
  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20, marginTop: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Department Compliance</div>
          <div className="card-subtitle">Overall: {complianceRate}%</div>
        </div>
        <div className="card-body">
          <ComplianceBar data={deptCompliance} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pass / Fail Trend</div>
          <div className="card-subtitle">Last 6 months</div>
        </div>
        <div className="card-body">
          <PassFailTrend data={trend} />
        </div>
      </div>
    </div>
  )
}

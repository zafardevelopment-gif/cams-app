'use client'

import { PassFailTrend, PassFailPie, ComplianceBar } from '@/components/charts/Charts'

interface TrendPoint { month: string; passed: number; failed: number }
interface ComplianceItem { name: string; compliance: number; total: number }

export default function HospitalAdminCharts({
  passFailTrend,
  deptCompliance,
  passed,
  failed,
  pending,
}: {
  passFailTrend: TrendPoint[]
  deptCompliance: ComplianceItem[]
  passed: number
  failed: number
  pending: number
}) {
  return (
    <div className="grid-3" style={{ gap: 20, marginBottom: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pass / Fail Trend</div>
          <div className="card-subtitle">Last 6 months</div>
        </div>
        <div className="card-body">
          <PassFailTrend data={passFailTrend} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Assessment Breakdown</div>
        </div>
        <div className="card-body">
          <PassFailPie passed={passed} failed={failed} pending={pending} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Dept Compliance</div>
        </div>
        <div className="card-body">
          <ComplianceBar data={deptCompliance} />
        </div>
      </div>
    </div>
  )
}

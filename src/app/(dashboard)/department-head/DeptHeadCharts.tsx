'use client'

import { PassFailTrend, PassFailPie } from '@/components/charts/Charts'

interface TrendPoint { month: string; passed: number; failed: number }

export default function DeptHeadCharts({
  trend,
  passed,
  failed,
  pending,
  passRate,
}: {
  trend: TrendPoint[]
  passed: number
  failed: number
  pending: number
  passRate: number
}) {
  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20, marginTop: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pass / Fail Trend</div>
          <div className="card-subtitle">Last 4 months</div>
        </div>
        <div className="card-body">
          <PassFailTrend data={trend} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Assessment Breakdown</div>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--gray-600)' }}>
            Pass rate: <strong style={{ color: passRate >= 70 ? 'var(--green)' : 'var(--red)' }}>{passRate}%</strong>
          </div>
          <PassFailPie passed={passed} failed={failed} pending={pending} />
        </div>
      </div>
    </div>
  )
}

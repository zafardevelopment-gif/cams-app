'use client'

import { ComplianceBar, PassFailTrend } from '@/components/charts/Charts'

interface DeptItem { name: string; compliance: number }
interface TrendPoint { month: string; passed: number; failed: number }

export default function BranchAdminCharts({
  deptBreakdown,
  monthlyTrend,
  branchCompliance,
}: {
  deptBreakdown: DeptItem[]
  monthlyTrend: TrendPoint[]
  branchCompliance: number
}) {
  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20, marginTop: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Department Compliance</div>
          <div className="card-subtitle">By department within branch</div>
        </div>
        <div className="card-body">
          <ComplianceBar data={deptBreakdown} />
          {deptBreakdown.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, paddingTop: 8 }}>
              No departments with assessment data
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pass / Fail Trend</div>
          <div className="card-subtitle">Last 4 months</div>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: branchCompliance >= 70 ? 'var(--green)' : 'var(--red)' }}>
              {branchCompliance}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>overall compliance</span>
          </div>
          <PassFailTrend data={monthlyTrend} />
        </div>
      </div>
    </div>
  )
}

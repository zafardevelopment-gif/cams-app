'use client'

import { CategoryPie, PassFailTrend } from '@/components/charts/Charts'

interface PieItem { name: string; value: number }
interface TrendPoint { month: string; passed: number; failed: number }

export default function EducatorCharts({
  categoryData,
  trend,
  completionRate,
}: {
  categoryData: PieItem[]
  trend: TrendPoint[]
  completionRate: number
}) {
  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20, marginTop: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Templates by Category</div>
        </div>
        <div className="card-body">
          <CategoryPie data={categoryData} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pass / Fail Trend</div>
          <div className="card-subtitle">Training completion: {completionRate}%</div>
        </div>
        <div className="card-body">
          <PassFailTrend data={trend} />
        </div>
      </div>
    </div>
  )
}

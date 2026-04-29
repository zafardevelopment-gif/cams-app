'use client'

import { MonthlyLine } from '@/components/charts/Charts'

interface MonthPoint { month: string; count: number }

export default function SuperAdminCharts({
  monthlyUsers,
  monthlyAssessments,
}: {
  monthlyUsers: MonthPoint[]
  monthlyAssessments: MonthPoint[]
}) {
  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">User Registrations (6 mo)</div>
        </div>
        <div className="card-body">
          <MonthlyLine data={monthlyUsers} color="#1565C0" label="New Users" />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Platform Assessments (6 mo)</div>
        </div>
        <div className="card-body">
          <MonthlyLine data={monthlyAssessments} color="#00897B" label="Assessments" />
        </div>
      </div>
    </div>
  )
}

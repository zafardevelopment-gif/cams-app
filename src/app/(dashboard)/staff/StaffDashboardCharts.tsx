'use client'

import { PassFailPie } from '@/components/charts/Charts'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export default function StaffDashboardCharts({
  passed,
  failed,
  pending,
  activeCerts,
  expiringCerts,
}: {
  passed: number
  failed: number
  pending: number
  activeCerts: number
  expiringCerts: number
}) {
  const certData = [
    { name: 'Active', value: activeCerts },
    { name: 'Expiring', value: expiringCerts },
  ].filter((d) => d.value > 0)

  const CERT_COLORS: Record<string, string> = { Active: '#43A047', Expiring: '#F9A825' }

  return (
    <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">My Assessment Results</div>
        </div>
        <div className="card-body">
          <PassFailPie passed={passed} failed={failed} pending={pending} />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">My Certificate Status</div>
        </div>
        <div className="card-body">
          {certData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={certData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                  {certData.map((entry) => (
                    <Cell key={entry.name} fill={CERT_COLORS[entry.name] ?? '#1565C0'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              No certificates yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

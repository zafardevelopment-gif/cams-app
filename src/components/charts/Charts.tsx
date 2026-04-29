'use client'

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Colours ──────────────────────────────────────────────────────────────────

const COLORS = ['#1565C0', '#00897B', '#F57F17', '#6A1B9A', '#C62828', '#2E7D32', '#0277BD', '#AD1457']
const GREEN = '#43A047'
const RED   = '#E53935'
const BLUE  = '#1565C0'

// ─── Pass/Fail Line Trend ─────────────────────────────────────────────────────

interface TrendPoint { month: string; passed: number; failed: number }

export function PassFailTrend({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) return <EmptyChart label="No trend data yet" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="passed" stroke={GREEN} strokeWidth={2} dot={false} name="Passed" />
        <Line type="monotone" dataKey="failed" stroke={RED} strokeWidth={2} dot={false} name="Failed" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Monthly Count Line ───────────────────────────────────────────────────────

interface MonthPoint { month: string; count: number }

export function MonthlyLine({ data, color = BLUE, label = 'Count' }: { data: MonthPoint[]; color?: string; label?: string }) {
  if (!data || data.length === 0) return <EmptyChart label="No trend data yet" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Compliance Bar Chart ─────────────────────────────────────────────────────

interface ComplianceBarItem { name: string; compliance: number; total?: number }

export function ComplianceBar({ data, label = 'Compliance %' }: { data: ComplianceBarItem[]; label?: string }) {
  if (!data || data.length === 0) return <EmptyChart label="No data available" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => [`${v}%`, label]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="compliance" fill={BLUE} radius={[4, 4, 0, 0]} name={label} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Branch Comparison Bar ────────────────────────────────────────────────────

interface BranchBarItem { branch: string; compliance: number; staff: number; assessments: number }

export function BranchComparisonBar({ data }: { data: BranchBarItem[] }) {
  if (!data || data.length === 0) return <EmptyChart label="No branch data yet" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="branch" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v, name) => [name === 'compliance' ? `${v}%` : v, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="compliance" fill={BLUE} radius={[4, 4, 0, 0]} name="Compliance %" />
        <Bar dataKey="staff" fill={GREEN} radius={[4, 4, 0, 0]} name="Staff Count" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Pass/Fail Pie ────────────────────────────────────────────────────────────

export function PassFailPie({ passed, failed, pending = 0 }: { passed: number; failed: number; pending?: number }) {
  const data = [
    { name: 'Passed', value: passed },
    { name: 'Failed', value: failed },
    ...(pending > 0 ? [{ name: 'In Progress', value: pending }] : []),
  ].filter((d) => d.value > 0)

  if (data.length === 0) return <EmptyChart label="No assessment data yet" />

  const PIE_COLORS: Record<string, string> = { Passed: GREEN, Failed: RED, 'In Progress': '#F9A825' }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? COLORS[0]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Category Pie ─────────────────────────────────────────────────────────────

interface PieItem { name: string; value: number }

export function CategoryPie({ data }: { data: PieItem[] }) {
  if (!data || data.length === 0) return <EmptyChart label="No template data yet" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Dept Performance Grouped Bar ────────────────────────────────────────────

interface DeptBarItem { department: string; passed: number; failed: number; compliance: number }

export function DeptPerformanceBar({ data }: { data: DeptBarItem[] }) {
  if (!data || data.length === 0) return <EmptyChart label="No department data yet" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="department" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="passed" fill={GREEN} radius={[3, 3, 0, 0]} name="Passed" stackId="a" />
        <Bar dataKey="failed" fill={RED} radius={[3, 3, 0, 0]} name="Failed" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
      {label}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { getInitials } from '@/lib/utils'

// ---- Types ----------------------------------------------------------------

type StaffShape    = { full_name: string; job_title: string } | null
type TemplateShape = { title: string; category: string } | null
type CertShape     = { certificate_number: string } | null

export type Renewal = {
  id: string
  status: string
  due_date: string
  template_id: string | null
  staff: StaffShape | StaffShape[]
  template: TemplateShape | TemplateShape[]
  certificate: CertShape | CertShape[]
}

export interface RenewalsClientProps {
  renewals: Renewal[]
  overdue: number
  due30: number
  upcoming: number
}

// ---- Constants ------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  overdue:     'badge-red',
  due:         'badge-yellow',
  upcoming:    'badge-blue',
  completed:   'badge-green',
  in_progress: 'badge-purple',
}

const STATUS_LABEL: Record<string, string> = {
  overdue:     'Overdue',
  due:         'Due',
  upcoming:    'Upcoming',
  completed:   'Completed',
  in_progress: 'In Progress',
}

// ---- Helpers --------------------------------------------------------------

function unwrapStaff(raw: Renewal['staff']): StaffShape {
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function unwrapTemplate(raw: Renewal['template']): TemplateShape {
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function unwrapCert(raw: Renewal['certificate']): CertShape {
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function daysLeft(dueDateStr: string): number {
  const due = new Date(dueDateStr)
  const today = new Date()
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function daysLeftLabel(days: number): string {
  return days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`
}

function daysLeftColor(days: number): string {
  if (days < 0 || days <= 7) return 'var(--red)'
  if (days <= 30)            return 'var(--amber)'
  return 'var(--green)'
}

// ---- CSV export -----------------------------------------------------------

function exportCSV(renewals: Renewal[]) {
  const today = new Date()

  const headers = [
    'Staff Name',
    'Job Title',
    'Competency',
    'Category',
    'Certificate #',
    'Due Date',
    'Days Left',
    'Status',
  ]

  const rows = renewals.map((r) => {
    const staff    = unwrapStaff(r.staff)
    const template = unwrapTemplate(r.template)
    const cert     = unwrapCert(r.certificate)
    const due      = new Date(r.due_date)
    const days     = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    return [
      staff?.full_name        ?? '',
      staff?.job_title        ?? '',
      template?.title         ?? '',
      template?.category      ?? '',
      cert?.certificate_number ?? '',
      r.due_date,
      days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`,
      STATUS_LABEL[r.status]  ?? r.status,
    ]
  })

  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `renewals-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ---- Component ------------------------------------------------------------

export default function RenewalsClient({ renewals, overdue, due30, upcoming }: RenewalsClientProps) {
  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Certificate Renewals</h1>
          <p>Track upcoming and overdue certificate renewals</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => exportCSV(renewals)}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFEBEE' }}>🔴</div>
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value">{overdue}</div>
          {overdue > 0 && <div className="kpi-change down">Immediate action needed</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#FFF8E1' }}>⚠️</div>
          <div className="kpi-label">Due within 30 days</div>
          <div className="kpi-value">{due30}</div>
          {due30 > 0 && <div className="kpi-change down">Action required soon</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#E3F2FD' }}>📅</div>
          <div className="kpi-label">Due in 30–90 days</div>
          <div className="kpi-value">{upcoming}</div>
          <div className="kpi-change neutral">Plan ahead</div>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Renewals</div>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Competency</th>
                  <th>Certificate #</th>
                  <th>Due Date</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((r) => {
                  const staff    = unwrapStaff(r.staff)
                  const template = unwrapTemplate(r.template)
                  const cert     = unwrapCert(r.certificate)
                  const days     = daysLeft(r.due_date)

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div
                            className="staff-avatar"
                            style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}
                          >
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <h4>{staff?.full_name ?? '—'}</h4>
                            <p>{staff?.job_title ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{template?.title ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>
                        {cert?.certificate_number ?? '—'}
                      </td>
                      <td className="text-sm">{r.due_date}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: daysLeftColor(days) }}>
                          {daysLeftLabel(days)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={r.template_id ? `/competencies/${r.template_id}/preview` : '/competencies'}
                          className="btn btn-primary btn-sm"
                        >
                          Start Renewal
                        </Link>
                      </td>
                    </tr>
                  )
                })}

                {renewals.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                      No renewals pending
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', failed: 'badge-red', in_progress: 'badge-yellow',
  submitted: 'badge-blue', assessor_review: 'badge-blue',
  head_nurse_review: 'badge-teal', admin_review: 'badge-purple', not_started: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', failed: 'Failed', in_progress: 'In Progress',
  submitted: 'Submitted', assessor_review: 'Evaluator Review',
  head_nurse_review: 'Supervisor Review', admin_review: 'Admin Approval', not_started: 'Not Started',
}

function resolveJoin<T>(raw: unknown): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw as T)
}

interface AssessmentRow {
  id: string
  status: string
  overall_score?: number
  quiz_auto_score?: number
  attempt_number: number
  reattempt_of?: string
  created_at: string
  due_date?: string
  submitted_at?: string
  staff: unknown
  assessor: unknown
  template: unknown
}

interface Props {
  assessments: AssessmentRow[]
  callerRole: string
  isStaff: boolean
  callerId: string
}

export function AssessmentsClient({ assessments, callerRole, isStaff, callerId }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = assessments.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const template = resolveJoin<{ title: string; category: string }>(a.template)
      const staff = resolveJoin<{ full_name: string }>(a.staff)
      return (
        (template?.title ?? '').toLowerCase().includes(q) ||
        (template?.category ?? '').toLowerCase().includes(q) ||
        (staff?.full_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // KPI counts
  const pending  = assessments.filter((a) => ['not_started','in_progress','submitted','assessor_review','head_nurse_review','admin_review'].includes(a.status)).length
  const passed   = assessments.filter((a) => a.status === 'passed').length
  const failed   = assessments.filter((a) => a.status === 'failed').length
  const myAction = assessments.filter((a) => {
    if (a.status === 'submitted' || a.status === 'assessor_review') return true
    if (a.status === 'head_nurse_review' && ['head_nurse','department_head','unit_head','hospital_admin','super_admin'].includes(callerRole)) return true
    if (a.status === 'admin_review' && ['hospital_admin','super_admin','branch_admin'].includes(callerRole)) return true
    return false
  }).length

  function getActionLabel(a: AssessmentRow): string {
    const staffRaw = resolveJoin<{ id: string }>(a.staff)
    const isOwn = staffRaw?.id === callerId
    if (isOwn && ['not_started', 'in_progress'].includes(a.status)) return 'Take'
    if (['submitted', 'assessor_review'].includes(a.status) && !isStaff) return 'Evaluate'
    if (['head_nurse_review', 'admin_review'].includes(a.status) && !isStaff) return 'Approve'
    return 'View'
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Assessments</h1>
          <p>{assessments.length} total</p>
        </div>
        <div className="page-header-actions">
          <Link href="/competencies" className="btn btn-primary btn-sm">＋ Start New Assessment</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'In Progress', value: pending, color: 'var(--blue)' },
          { label: 'Passed', value: passed, color: 'var(--green)' },
          { label: 'Failed', value: failed, color: 'var(--red)' },
          { label: 'Need Action', value: myAction, color: 'var(--amber, #f59e0b)' },
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <span>🔍</span>
          <input placeholder="Search by name or competency…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="assessor_review">Evaluator Review</option>
          <option value="head_nurse_review">Supervisor Review</option>
          <option value="admin_review">Admin Approval</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Competency</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Attempt</th>
                  <th>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const staff    = resolveJoin<{ full_name: string; job_title?: string; id: string }>(a.staff)
                  const template = resolveJoin<{ title: string; category: string; passing_score: number }>(a.template)
                  const score    = a.overall_score ?? a.quiz_auto_score
                  const actionLabel = getActionLabel(a)
                  const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !['passed','failed'].includes(a.status)

                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar" style={{ background: 'linear-gradient(135deg,var(--blue),var(--teal))' }}>
                            {getInitials(staff?.full_name ?? '?')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{staff?.full_name ?? '—'}</div>
                            <div className="text-xs text-muted">{staff?.job_title ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{template?.title ?? '—'}</div>
                        <div className="text-xs text-muted">{template?.category ?? ''}</div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {score != null
                          ? <span style={{ color: template && score >= template.passing_score ? 'var(--green)' : 'var(--red)' }}>{score}%</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td className="text-sm text-muted">
                        #{a.attempt_number}
                        {a.reattempt_of && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 4 }}>re</span>}
                      </td>
                      <td className="text-sm" style={{ color: isOverdue ? 'var(--red)' : 'var(--gray-500)' }}>
                        {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                        {isOverdue && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠</span>}
                      </td>
                      <td>
                        <Link href={`/assessments/${a.id}`}
                          className={`btn btn-sm ${actionLabel === 'Take' ? 'btn-primary' : actionLabel === 'Evaluate' || actionLabel === 'Approve' ? 'btn-warning' : 'btn-secondary'}`}
                          style={actionLabel === 'Evaluate' || actionLabel === 'Approve' ? { background: 'var(--amber, #f59e0b)', color: 'white', border: 'none' } : {}}>
                          {actionLabel}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>No assessments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

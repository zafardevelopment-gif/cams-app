'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { processApproval, reattemptAssessment } from '@/actions/assessments'
import { formatDateRelative } from '@/lib/utils'

export interface ApprovalRow {
  id: string
  level: number
  status: string
  comments?: string
  approved_at?: string
  approver?: { full_name: string } | { full_name: string }[]
}

interface Props {
  assessmentId: string
  status: string
  overall_score?: number
  passing_score: number
  attempt_number: number
  approvals: ApprovalRow[]
  totalLevels: number
  callerRole: string
  isStaff: boolean
  knowledge_score?: number
  quiz_score?: number
  practical_score?: number
  quiz_auto_score?: number
  evaluator_notes?: string
  assessor_notes?: string
  templateTitle: string
  staffName: string
}

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', failed: 'badge-red', in_progress: 'badge-yellow',
  submitted: 'badge-blue', assessor_review: 'badge-blue',
  head_nurse_review: 'badge-teal', admin_review: 'badge-purple',
  not_started: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', failed: 'Failed', in_progress: 'In Progress',
  submitted: 'Submitted', assessor_review: 'Evaluator Review',
  head_nurse_review: 'Supervisor Review', admin_review: 'Admin Approval',
  not_started: 'Not Started',
}
const LEVEL_LABELS: Record<number, string> = {
  1: 'Assessor / Educator', 2: 'Supervisor Approval', 3: 'Admin Approval',
  4: 'Senior Management', 5: 'CMO Approval',
}

export function ApprovalClient({
  assessmentId, status, overall_score, passing_score, attempt_number,
  approvals, totalLevels, callerRole, isStaff,
  knowledge_score, quiz_score, practical_score, quiz_auto_score,
  evaluator_notes, assessor_notes, templateTitle, staffName,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [comments, setComments] = useState('')
  const [showReattempt, setShowReattempt] = useState(false)

  const levelsCompleted = approvals.filter((a) => a.status === 'approved').length
  const nextPendingApproval = approvals.find((a) => a.status === 'pending')
  const isFinal = status === 'passed' || status === 'failed'

  const APPROVER_ROLES = ['hospital_admin','super_admin','branch_admin','department_head','unit_head','head_nurse','hr_quality','assessor','educator']
  const canApprove = APPROVER_ROLES.includes(callerRole) && !isFinal && !!nextPendingApproval
  const canReattempt = status === 'failed' && (isStaff || APPROVER_ROLES.includes(callerRole))

  function handleApprove(approvalId: string) {
    startTransition(async () => {
      const r = await processApproval(approvalId, 'approved', comments || undefined)
      if (r.success) { toast.success('Approved'); window.location.reload() }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleReject(approvalId: string) {
    if (!comments.trim()) { toast.error('Please add a comment when rejecting'); return }
    startTransition(async () => {
      const r = await processApproval(approvalId, 'rejected', comments)
      if (r.success) { toast.success('Rejected'); window.location.reload() }
      else toast.error(r.error ?? 'Failed')
    })
  }

  function handleReattempt() {
    startTransition(async () => {
      const r = await reattemptAssessment(assessmentId)
      if (r.success && r.data) {
        toast.success('New attempt created')
        window.location.href = `/assessments/${r.data.id}`
      } else {
        toast.error(r.error ?? 'Failed')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Status summary */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Result</div>
          <span className={`badge ${STATUS_BADGE[status] ?? 'badge-gray'}`}>{STATUS_LABEL[status] ?? status}</span>
        </div>
        <div className="card-body">
          <div className="stat-row"><span className="stat-label">Staff</span><span className="stat-value">{staffName}</span></div>
          <div className="stat-row"><span className="stat-label">Attempt</span><span className="stat-value">#{attempt_number}</span></div>
          {quiz_auto_score != null && quiz_score == null && (
            <div className="stat-row"><span className="stat-label">Quiz (auto)</span><span className="stat-value">{quiz_auto_score}%</span></div>
          )}
          {knowledge_score != null && <div className="stat-row"><span className="stat-label">Knowledge</span><span className="stat-value">{knowledge_score}%</span></div>}
          {quiz_score != null && <div className="stat-row"><span className="stat-label">Quiz</span><span className="stat-value">{quiz_score}%</span></div>}
          {practical_score != null && <div className="stat-row"><span className="stat-label">Practical</span><span className="stat-value">{practical_score}%</span></div>}
          {overall_score != null && (
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Overall Score</span>
                <span style={{ fontWeight: 700, fontSize: 20, color: overall_score >= passing_score ? 'var(--green)' : 'var(--red)' }}>
                  {overall_score}%
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${overall_score}%`, background: overall_score >= passing_score ? 'var(--green)' : 'var(--red)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                  Pass: {passing_score}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evaluator notes */}
      {(evaluator_notes || assessor_notes) && (
        <div className="card">
          <div className="card-header"><div className="card-title">Evaluator Notes</div></div>
          <div className="card-body">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--gray-700)' }}>
              {evaluator_notes || assessor_notes}
            </p>
          </div>
        </div>
      )}

      {/* Approval chain */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Approval Chain</div>
            <div className="card-subtitle">{levelsCompleted}/{totalLevels} completed</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 16 }}>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill progress-green" style={{ width: `${(levelsCompleted / Math.max(totalLevels, 1)) * 100}%` }} />
            </div>
          </div>

          <div className="timeline">
            {Array.from({ length: totalLevels }, (_, i) => i + 1).map((level) => {
              const ap = approvals.find((a) => a.level === level)
              const isCompleted = ap?.status === 'approved'
              const isRejected  = ap?.status === 'rejected'
              const isPending   = !ap || ap.status === 'pending'
              const approverRaw = ap?.approver
              const approver = Array.isArray(approverRaw) ? approverRaw[0] : approverRaw as { full_name: string } | null

              return (
                <div key={level} className={`timeline-item ${isCompleted ? 'done' : ''}`}>
                  <div className="timeline-dot" style={{
                    background: isCompleted ? 'var(--green)' : isRejected ? 'var(--red)' : isPending && levelsCompleted >= level - 1 ? 'var(--blue)' : 'var(--gray-200)',
                    color: isCompleted || isRejected || (isPending && levelsCompleted >= level - 1) ? 'white' : 'var(--gray-300)',
                  }}>
                    {isCompleted ? '✓' : isRejected ? '✗' : level}
                  </div>
                  <div className="timeline-content">
                    <h4>{LEVEL_LABELS[level] ?? `Level ${level}`}</h4>
                    {approver && <p>By: {approver.full_name}</p>}
                    {ap?.comments && <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--gray-500)' }}>&quot;{ap.comments}&quot;</p>}
                    <div className="time">
                      {isCompleted ? `Approved ${ap?.approved_at ? formatDateRelative(ap.approved_at) : ''}` : isRejected ? 'Rejected' : levelsCompleted >= level - 1 ? 'Awaiting approval' : 'Waiting'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Approve / reject controls */}
          {canApprove && nextPendingApproval && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--navy)' }}>
                Your action required — Level {nextPendingApproval.level}: {LEVEL_LABELS[nextPendingApproval.level] ?? `Level ${nextPendingApproval.level}`}
              </div>
              <div className="form-group">
                <label className="form-label">Comments (required for rejection)</label>
                <textarea className="form-control" rows={3} value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add comments or feedback…" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success" style={{ flex: 1 }}
                  onClick={() => handleApprove(nextPendingApproval.id)} disabled={isPending}>
                  {isPending ? '…' : '✓ Approve'}
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }}
                  onClick={() => handleReject(nextPendingApproval.id)} disabled={isPending}>
                  {isPending ? '…' : '✗ Reject'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Passed */}
      {status === 'passed' && (
        <div style={{ background: '#F0FFF4', border: '1px solid #68D391', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏅</div>
          <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15, marginBottom: 4 }}>Competency Passed!</div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>A certificate has been issued for {templateTitle}.</div>
          <a href="/certificates" className="btn btn-secondary btn-sm">View Certificate →</a>
        </div>
      )}

      {/* Failed + reattempt */}
      {status === 'failed' && (
        <div style={{ background: '#FFF5F5', border: '1px solid #FC8181', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Assessment Not Passed</div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>
            Score: {overall_score ?? '—'}% (required: {passing_score}%). You may attempt again.
          </div>
          {canReattempt && (
            !showReattempt ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowReattempt(true)}>
                🔄 Start Reattempt
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, marginBottom: 10 }}>This will create a new attempt (#{attempt_number + 1}) for {templateTitle}. Confirm?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowReattempt(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleReattempt} disabled={isPending}>
                    {isPending ? 'Creating…' : 'Confirm Reattempt'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

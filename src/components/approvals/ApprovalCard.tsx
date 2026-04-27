'use client'

import { useTransition, useRef } from 'react'
import Link from 'next/link'
import { processApproval } from '@/actions/assessments'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface ApprovalCardProps {
  approvalId: string
  level: number
  assessmentId: string
  staffName?: string
  jobTitle?: string
  templateTitle?: string
  templateCategory?: string
  passingScore?: number
  overallScore?: number | null
  submittedAt?: string | null
}

export default function ApprovalCard({
  approvalId,
  level,
  assessmentId,
  staffName,
  jobTitle,
  templateTitle,
  templateCategory,
  passingScore,
  overallScore,
  submittedAt,
}: ApprovalCardProps) {
  const [isPending, startTransition] = useTransition()
  const commentsRef = useRef<HTMLTextAreaElement>(null)

  const passing = overallScore != null && passingScore != null
    ? overallScore >= passingScore
    : null

  function handleAction(action: 'approved' | 'rejected') {
    const comments = commentsRef.current?.value || undefined
    startTransition(async () => {
      const result = await processApproval(approvalId, action, comments)
      if (result.success) {
        toast.success(action === 'approved' ? 'Assessment approved' : 'Assessment rejected')
      } else {
        toast.error(result.error ?? 'Failed to process approval')
      }
    })
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{templateTitle}</div>
          <div className="card-subtitle">{templateCategory}</div>
        </div>
        <span className="badge badge-amber">Level {level} Approval</span>
      </div>
      <div className="card-body">
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <div className="stat-row">
              <span className="stat-label">Staff Member</span>
              <span className="stat-value">{staffName}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Job Title</span>
              <span className="stat-value">{jobTitle}</span>
            </div>
          </div>
          <div>
            <div className="stat-row">
              <span className="stat-label">Overall Score</span>
              <span className="stat-value" style={{ color: passing === true ? 'var(--green)' : passing === false ? 'var(--red)' : 'var(--navy)' }}>
                {overallScore != null ? `${overallScore}%` : 'Pending'}
                {passing === true && ' ✓'}
                {passing === false && ' ✗'}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Submitted</span>
              <span className="stat-value">{submittedAt ? formatDate(submittedAt) : '—'}</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Approval Comments</label>
          <textarea
            ref={commentsRef}
            className="form-control"
            rows={2}
            placeholder="Add comments (optional)…"
            disabled={isPending}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-success"
            onClick={() => handleAction('approved')}
            disabled={isPending}
          >
            {isPending ? 'Processing…' : '✓ Approve Assessment'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleAction('rejected')}
            disabled={isPending}
          >
            ✗ Reject
          </button>
          <Link href={`/assessments/${assessmentId}`} className="btn btn-secondary">
            View Full Assessment
          </Link>
        </div>
      </div>
    </div>
  )
}

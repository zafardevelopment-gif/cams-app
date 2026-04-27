'use client'

import { useState, useTransition } from 'react'
import { approveRegistration, rejectRegistration } from '@/actions/users'
import { toast } from 'sonner'
import { getRoleLabel } from '@/lib/utils'
import type { UserRole } from '@/types'

const ASSIGNABLE_ROLES: UserRole[] = [
  'staff',
  'assessor',
  'educator',
  'head_nurse',
  'unit_head',
  'department_head',
  'hr_quality',
  'branch_admin',
  'hospital_admin',
  'auditor',
]

export function ApprovalActions({
  registrationId,
  name,
  defaultRole = 'staff',
}: {
  registrationId: string
  name: string
  defaultRole?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [reason, setReason] = useState('')
  const [assignedRole, setAssignedRole] = useState<UserRole>((defaultRole as UserRole) ?? 'staff')

  function handleApprove() {
    startTransition(async () => {
      const result = await approveRegistration(registrationId, assignedRole)
      if (result.success) {
        toast.success(`${name} approved as ${getRoleLabel(assignedRole)}`)
        setShowApprove(false)
      } else {
        toast.error(result.error ?? 'Failed to approve')
      }
    })
  }

  function handleReject() {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    startTransition(async () => {
      const result = await rejectRegistration(registrationId, reason)
      if (result.success) {
        toast.success('Registration rejected')
        setShowReject(false)
      } else {
        toast.error(result.error ?? 'Failed to reject')
      }
    })
  }

  if (showReject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <textarea
          className="form-control"
          rows={2}
          placeholder="Rejection reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-danger btn-sm" onClick={handleReject} disabled={isPending}>
            {isPending ? '…' : 'Confirm'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowReject(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (showApprove) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 }}>Assign role:</div>
        <select
          className="form-control"
          value={assignedRole}
          onChange={(e) => setAssignedRole(e.target.value as UserRole)}
          style={{ fontSize: 12 }}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{getRoleLabel(r)}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-success btn-sm" onClick={handleApprove} disabled={isPending}>
            {isPending ? '…' : '✓ Confirm'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowApprove(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        className="btn btn-success btn-sm"
        onClick={() => setShowApprove(true)}
        disabled={isPending}
      >
        ✓ Approve
      </button>
      <button
        className="btn btn-danger btn-sm"
        onClick={() => setShowReject(true)}
        disabled={isPending}
      >
        ✗ Reject
      </button>
    </div>
  )
}

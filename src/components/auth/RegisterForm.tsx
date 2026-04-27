'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { register } from '@/actions/auth'
import { toast } from 'sonner'

interface Hospital { id: string; name: string }
interface Branch { id: string; name: string; hospital_id: string }
interface Department { id: string; name: string; hospital_id: string; branch_id?: string | null }

export function RegisterForm({ hospitals }: { hospitals: Hospital[] }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedHospital, setSelectedHospital] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingDepts, setLoadingDepts] = useState(false)

  async function onHospitalChange(hospitalId: string) {
    setSelectedHospital(hospitalId)
    setSelectedBranch('')
    setBranches([])
    setDepartments([])

    if (!hospitalId) return

    setLoadingBranches(true)
    try {
      const res = await fetch(`/api/public/branches?hospital_id=${hospitalId}`)
      const json = await res.json()
      setBranches(json.branches ?? [])
      // If no branches, load departments directly
      if ((json.branches ?? []).length === 0) {
        await loadDepartments(hospitalId, '')
      }
    } finally {
      setLoadingBranches(false)
    }
  }

  async function onBranchChange(branchId: string) {
    setSelectedBranch(branchId)
    setDepartments([])
    await loadDepartments(selectedHospital, branchId)
  }

  async function loadDepartments(hospitalId: string, branchId: string) {
    if (!hospitalId) return
    setLoadingDepts(true)
    try {
      const params = new URLSearchParams({ hospital_id: hospitalId })
      if (branchId) params.set('branch_id', branchId)
      const res = await fetch(`/api/public/departments?${params}`)
      const json = await res.json()
      setDepartments(json.departments ?? [])
    } finally {
      setLoadingDepts(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    const pw = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string
    if (pw !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await register(formData)
      if (result.success) {
        setDone(true)
        toast.success('Registration submitted!')
      } else {
        setError(result.error ?? 'Registration failed')
        toast.error(result.error ?? 'Registration failed')
      }
    })
  }

  if (done) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            Registration Submitted
          </h2>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.7 }}>
            Your account request has been submitted for admin review. You will receive an email once approved.
          </p>
          <Link href="/login" className="btn btn-primary">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
          Request Account Access
        </h2>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 28 }}>
          Complete the form below. Your request will be reviewed by a hospital administrator.
        </p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠️ {error}</div>
        )}

        <div className="card">
          <div className="card-body">
            <form action={handleSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input name="full_name" className="form-control" required placeholder="e.g. Reem Al-Otaibi" />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input name="employee_id" className="form-control" placeholder="EMP-0001" />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input name="email" type="email" className="form-control" required placeholder="reem@hospital.sa" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input name="phone" type="tel" className="form-control" placeholder="+966 5x xxx xxxx" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input name="job_title" className="form-control" placeholder="e.g. Senior Nurse" />
              </div>

              <div className="form-group">
                <label className="form-label">Nursing License Number</label>
                <input name="nursing_license" className="form-control" placeholder="SCH-XXXX-XXXX" />
              </div>

              {/* Hospital → Branch → Department cascade */}
              <div className="form-group">
                <label className="form-label">Hospital</label>
                <select
                  name="hospital_id"
                  className="form-control"
                  value={selectedHospital}
                  onChange={(e) => onHospitalChange(e.target.value)}
                >
                  <option value="">Select hospital</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Branch {loadingBranches && <span className="text-muted text-xs">Loading…</span>}</label>
                  <select
                    name="branch_id"
                    className="form-control"
                    value={selectedBranch}
                    onChange={(e) => onBranchChange(e.target.value)}
                  >
                    <option value="">Select branch (optional)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(departments.length > 0 || loadingDepts) && (
                <div className="form-group">
                  <label className="form-label">Department {loadingDepts && <span className="text-muted text-xs">Loading…</span>}</label>
                  <select name="department_id" className="form-control" disabled={loadingDepts}>
                    <option value="">Select department (optional)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input name="password" type="password" className="form-control" required minLength={8} placeholder="Min 8 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input name="confirm_password" type="password" className="form-control" required placeholder="Repeat password" />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={isPending}
                style={{ marginTop: 8 }}
              >
                {isPending ? '⏳ Submitting…' : '📋 Submit Registration Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

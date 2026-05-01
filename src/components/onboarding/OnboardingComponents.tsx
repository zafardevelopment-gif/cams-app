'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DEFAULT_CONFIG, getActiveSetupSteps } from '@/lib/hospitalConfig'
import type { HospitalConfig } from '@/lib/hospitalConfig'

// ─── Zero State — Branches ───────────────────────────────────────────────────

export function BranchZeroState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏢</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.5rem' }}>No branches created yet</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 32, lineHeight: 1.6 }}>
        Start by creating your first branch. A branch represents a physical location or campus of your hospital.
        Once you have a branch, you can add departments, units, and staff to it.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 48 }}>
        <button className="btn btn-primary" onClick={onCreateClick}>
          🏢 Create First Branch
        </button>
        <a
          href="#setup-guide"
          className="btn btn-secondary"
          onClick={(e) => { e.preventDefault(); document.getElementById('setup-guide')?.scrollIntoView({ behavior: 'smooth' }) }}
        >
          📖 View Setup Guide
        </a>
      </div>

      <div id="setup-guide" className="card" style={{ textAlign: 'left' }}>
        <div className="card-header">
          <div className="card-title">🚀 Setup Guide — 6 Steps to Go Live</div>
          <div className="card-subtitle">Follow these steps in order to get your hospital fully set up</div>
        </div>
        <div className="card-body">
          <SetupStepList currentStep={0} />
        </div>
      </div>
    </div>
  )
}

// ─── No-Branch Guard ─────────────────────────────────────────────────────────

export function NoBranchGuard({ pageName }: { pageName: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏢</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.4rem' }}>Create a Branch First</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 8, lineHeight: 1.6 }}>
        You need at least one branch before you can use <strong>{pageName}</strong>.
      </p>
      <p style={{ color: 'var(--gray-500)', marginBottom: 32, lineHeight: 1.6, fontSize: '0.9rem' }}>
        A branch represents a physical location of your hospital (e.g. Main Campus, North Wing).
        Once a branch exists, all other setup steps become available.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link href="/hospital/branches" className="btn btn-primary">
          🏢 Create First Branch
        </Link>
        <Link href="/hospital-admin" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
      <div style={{
        marginTop: 36,
        padding: '16px 20px',
        background: 'var(--gray-50)',
        border: '1px solid var(--gray-200)',
        borderRadius: 10,
        textAlign: 'left',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--navy)', marginBottom: 10 }}>Setup order:</div>
        {[
          { n: 1, icon: '🏢', label: 'Create Branch', active: true },
          { n: 2, icon: '🏬', label: 'Create Departments', active: false },
          { n: 3, icon: '🔲', label: 'Create Units', active: false },
          { n: 4, icon: '👥', label: 'Add Staff', active: false },
          { n: 5, icon: '📚', label: 'Create Competencies', active: false },
        ].map(({ n, icon, label, active }) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--blue)' : 'var(--gray-200)', color: active ? 'white' : 'var(--gray-500)',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{n}</div>
            <span style={{ fontSize: '0.85rem', fontWeight: active ? 700 : 400, color: active ? 'var(--navy)' : 'var(--gray-400)' }}>
              {icon} {label} {active && '← You are here'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Zero State — Departments ────────────────────────────────────────────────

export function DepartmentZeroState({ hasBranches }: { hasBranches: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏬</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.4rem' }}>No departments found</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
        {hasBranches
          ? 'Departments are created automatically when you run database migrations. Contact your system administrator to seed department data for this hospital.'
          : 'You need to create a branch first before departments can be assigned. Go to Branches and create your first branch.'}
      </p>
      {!hasBranches && (
        <Link href="/hospital/branches" className="btn btn-primary">
          🏢 Go to Branches
        </Link>
      )}
    </div>
  )
}

// ─── Zero State — Units ───────────────────────────────────────────────────────

export function UnitZeroState({ hasDepartments, onCreateClick }: { hasDepartments: boolean; onCreateClick: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🔲</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.4rem' }}>No units created yet</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
        {hasDepartments
          ? 'Units are sub-groups within a department — for example, ICU, CCU, or Ward A. Click below to create your first unit.'
          : 'You need to create a department first before adding units. Go to Departments to get started.'}
      </p>
      {hasDepartments ? (
        <button className="btn btn-primary" onClick={onCreateClick}>🔲 Create First Unit</button>
      ) : (
        <Link href="/hospital/departments" className="btn btn-primary">🏬 Go to Departments</Link>
      )}
    </div>
  )
}

// ─── Zero State — Staff Directory ─────────────────────────────────────────────

export function StaffZeroState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>👥</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.4rem' }}>No staff added yet</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
        Add your first staff member manually, or bulk import using a CSV file.
        Staff can also self-register and you approve them from the Pending Registrations queue.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link href="/hospital-admin/pending-registrations" className="btn btn-secondary">
          📋 Pending Registrations
        </Link>
      </div>
    </div>
  )
}

// ─── Zero State — Competencies ────────────────────────────────────────────────

export function CompetencyZeroState({ canEdit }: { canEdit: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📚</div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.4rem' }}>No competency templates created yet</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
        Competency templates define what skills and knowledge staff need to demonstrate.
        {canEdit
          ? ' Create your first template to start assigning assessments to staff.'
          : ' An Educator or Hospital Admin can create templates for your hospital.'}
      </p>
      {canEdit && (
        <Link href="/competencies/new" className="btn btn-primary">📝 Create First Template</Link>
      )}
    </div>
  )
}

// ─── Setup Step List ─────────────────────────────────────────────────────────

export function SetupStepList({ currentStep, config }: { currentStep: number; config?: HospitalConfig | null }) {
  const steps = getActiveSetupSteps(config ?? DEFAULT_CONFIG)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map(({ key, icon, label, desc, href }, idx) => {
        const stepNum = idx + 1
        const done = stepNum <= currentStep
        const active = stepNum === currentStep + 1
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '10px 14px',
              borderRadius: 8,
              background: done ? '#E8F5E9' : active ? '#EBF5FB' : 'var(--gray-50)',
              border: `1px solid ${done ? '#C8E6C9' : active ? '#BBDEFB' : 'var(--gray-200)'}`,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700,
              background: done ? '#4CAF50' : active ? 'var(--blue)' : 'var(--gray-300)',
              color: done || active ? 'white' : 'var(--gray-600)',
            }}>
              {done ? '✓' : stepNum}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: done ? '#2E7D32' : active ? 'var(--navy)' : 'var(--gray-500)' }}>
                {icon} {label}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 2 }}>{desc}</div>
            </div>
            {active && (
              <Link href={href} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                Start →
              </Link>
            )}
            {done && <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>Done ✓</span>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Post-Creation Next Steps Banner ─────────────────────────────────────────

interface NextStepsBannerProps {
  title: string
  subtitle: string
  actions: { label: string; href: string; primary?: boolean }[]
  onDismiss?: () => void
}

export function NextStepsBanner({ title, subtitle, actions, onDismiss }: NextStepsBannerProps) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #E8F5E9, #E3F2FD)',
      border: '1px solid #C8E6C9',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ fontSize: 28 }}>🎉</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className={`btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}`}>
            {a.label}
          </Link>
        ))}
      </div>
      {onDismiss && (
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, flexShrink: 0 }}
          onClick={() => { setVisible(false); onDismiss() }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Branch Progress Card ─────────────────────────────────────────────────────

interface BranchProgressProps {
  branchName: string
  deptCount: number
  unitCount: number
  staffCount: number
  competencyCount: number
  assessmentCount: number
}

export function BranchProgressCard({ branchName, deptCount, unitCount, staffCount, competencyCount, assessmentCount }: BranchProgressProps) {
  const items = [
    { label: 'Branch created',           done: true,              count: null },
    { label: 'Departments',              done: deptCount > 0,     count: deptCount },
    { label: 'Units',                    done: unitCount > 0,     count: unitCount },
    { label: 'Staff',                    done: staffCount > 0,    count: staffCount },
    { label: 'Competency templates',     done: competencyCount > 0, count: competencyCount },
    { label: 'Assessments started',      done: assessmentCount > 0, count: assessmentCount },
  ]
  const completedCount = items.filter((i) => i.done).length
  const pct = Math.round((completedCount / items.length) * 100)

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div>
          <div className="card-title">🏢 {branchName}</div>
          <div className="card-subtitle">Setup Progress</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: pct === 100 ? '#4CAF50' : 'var(--blue)' }}>{pct}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{completedCount}/{items.length} steps</div>
        </div>
      </div>
      <div className="card-body">
        <div style={{ background: 'var(--gray-100)', borderRadius: 99, height: 6, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4CAF50' : 'var(--blue)', borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px' }}>
          {items.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <span style={{ fontSize: 14 }}>{item.done ? '✅' : '❌'}</span>
              <span style={{ color: item.done ? 'var(--navy)' : 'var(--gray-400)' }}>
                {item.label}
                {item.count !== null && item.count > 0 && (
                  <span style={{ color: 'var(--gray-400)', marginLeft: 4 }}>({item.count})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding Wizard ────────────────────────────────────────────────────────

interface WizardProps {
  currentStep: number
  onDismiss: () => void
  config?: HospitalConfig | null
}

export function OnboardingWizard({ currentStep, onDismiss, config }: WizardProps) {
  const [dismissed, setDismissed] = useState(false)
  const steps = getActiveSetupSteps(config ?? DEFAULT_CONFIG)
  if (dismissed || currentStep >= steps.length) return null

  const step = steps[currentStep]

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0B1F3A, #1565C0)',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      color: 'white',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 4 }}>
            Setup Wizard · Step {currentStep + 1} of {steps.length}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {step.icon} {step.label}
          </div>
          <div style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: 4 }}>{step.desc}</div>
        </div>
        <button
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}
          onClick={() => { setDismissed(true); onDismiss() }}
        >
          Skip setup
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{
            height: 4, flex: 1, borderRadius: 99,
            background: i < currentStep ? '#4CAF50' : i === currentStep ? 'white' : 'rgba(255,255,255,0.25)',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href={step.href} className="btn btn-sm" style={{ background: 'white', color: 'var(--navy)', fontWeight: 600 }}>
          Go to {step.label} →
        </Link>
        {currentStep > 0 && (
          <span style={{ opacity: 0.7, fontSize: '0.8rem', alignSelf: 'center' }}>
            ✓ {currentStep} step{currentStep !== 1 ? 's' : ''} completed
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Roles Help Panel ─────────────────────────────────────────────────────────

const ROLES = [
  {
    icon: '🏥', role: 'Hospital Admin',
    can: ['Creates branches, departments & units', 'Approves or rejects user registrations', 'Final approval on assessments', 'Views all reports and settings'],
  },
  {
    icon: '🏢', role: 'Branch Admin',
    can: ['Manages staff within their branch', 'Monitors branch-level performance', 'Approves branch registrations'],
  },
  {
    icon: '📚', role: 'Educator',
    can: ['Creates competency templates', 'Assigns assessments to staff', 'Tracks learning outcomes'],
  },
  {
    icon: '✅', role: 'Assessor',
    can: ['Evaluates and grades submitted assessments', 'Scores each criterion', 'Forwards to approval chain'],
  },
  {
    icon: '👩‍⚕️', role: 'Head Nurse / Unit Head',
    can: ['Reviews assessments in their dept/unit', 'Approves or rejects assessments', 'Monitors staff compliance'],
  },
  {
    icon: '📋', role: 'HR / Quality',
    can: ['Read-only access to all data', 'Generates compliance reports', 'Monitors certificate expiry'],
  },
  {
    icon: '👤', role: 'Staff',
    can: ['Completes assigned assessments', 'Views own certificates', 'Requests renewals and transfers'],
  },
]

export function RolesHelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔑 Roles &amp; Responsibilities</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <p style={{ color: 'var(--gray-500)', marginBottom: 20, fontSize: '0.9rem' }}>
            Each user in CAMS has a role that determines what they can see and do. Assign the right role when approving new registrations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ROLES.map(({ icon, role, can }) => (
              <div key={role} style={{
                border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{role}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
                    {can.map((c) => (
                      <li key={c} style={{ fontSize: '0.83rem', color: 'var(--gray-600)', marginBottom: 2 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

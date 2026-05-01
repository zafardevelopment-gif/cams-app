'use client'

import Link from 'next/link'
import { useState } from 'react'
import { OnboardingWizard, RolesHelpPanel } from '@/components/onboarding/OnboardingComponents'
import { getActiveSetupSteps } from '@/lib/hospitalConfig'
import type { HospitalConfig } from '@/lib/hospitalConfig'

interface Props {
  /** Index (0-based) of the first incomplete active step; equals activeSteps.length when all done. */
  setupStep: number
  totalStaff: number
  config: HospitalConfig
}

// Per-step descriptions shown in the full-screen welcome checklist
const STEP_DESC: Record<string, string> = {
  branch:     'Physical location of your hospital (e.g. Main Campus)',
  department: 'Organise staff by department (e.g. ICU, Radiology)',
  unit:       'Sub-groups within a department (e.g. Ward A)',
  staff:      'Import or invite staff accounts',
  competency: 'Define skills staff need to demonstrate',
  assessment: 'Assign and run competency assessments',
}

export function HospitalOnboardingBanner({ setupStep, config }: Props) {
  const [wizardDismissed, setWizardDismissed] = useState(false)
  const [showRoles, setShowRoles] = useState(false)

  const activeSteps = getActiveSetupSteps(config)
  const allDone = setupStep >= activeSteps.length

  // ── Full-screen welcome: shown only when nothing has been set up yet ──────
  if (setupStep === 0 && activeSteps.length > 0) {
    const firstStep = activeSteps[0]

    return (
      <>
        <div style={{
          background: 'linear-gradient(135deg, #EBF5FB 0%, #E8F5E9 100%)',
          border: '2px solid #BBDEFB',
          borderRadius: 16,
          padding: '40px 32px',
          marginBottom: 28,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{firstStep.icon}</div>
          <h2 style={{ color: 'var(--navy)', fontSize: '1.6rem', marginBottom: 10 }}>
            Welcome to CAMS!
          </h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '1rem', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.7 }}>
            {STEP_DESC[firstStep.key]
              ? <>To get started, complete the first step: <strong>{firstStep.label}</strong>. {STEP_DESC[firstStep.key]}.</>
              : <>Follow the setup checklist below. Each step unlocks the next.</>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <Link
              href={firstStep.href}
              className="btn btn-primary"
              style={{ fontSize: '1rem', padding: '12px 32px' }}
            >
              {firstStep.icon} {firstStep.label}
            </Link>
            <Link
              href="/settings#hospital-structure"
              style={{ fontSize: '0.8rem', color: 'var(--gray-500)', textDecoration: 'underline' }}
            >
              ⚙️ Need to change structure? Configure in Settings first
            </Link>
          </div>

          {/* Setup checklist */}
          <div style={{
            background: 'white', border: '1px solid var(--gray-200)', borderRadius: 12,
            padding: '20px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'left',
          }}>
            <div style={{
              fontWeight: 700, fontSize: '0.8rem', color: 'var(--navy)', marginBottom: 14,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Setup Checklist — {activeSteps.length} steps
            </div>

            {activeSteps.map((step, idx) => {
              const isCurrent = idx === 0
              return (
                <div
                  key={step.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: isCurrent ? '10px 14px' : '8px 14px',
                    background: isCurrent ? '#EBF5FB' : 'var(--gray-50)',
                    border: isCurrent ? '2px solid var(--blue)' : '1px solid var(--gray-200)',
                    borderRadius: 8,
                    marginBottom: idx < activeSteps.length - 1 ? 8 : 0,
                    opacity: isCurrent ? 1 : 0.5,
                  }}
                >
                  {/* Step number bubble */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isCurrent ? 'var(--blue)' : 'var(--gray-300)',
                    color: isCurrent ? 'white' : 'var(--gray-600)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {idx + 1}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? 'var(--navy)' : 'var(--gray-500)',
                      fontSize: '0.9rem',
                    }}>
                      {step.icon} {step.label}
                    </div>
                    {isCurrent && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 1 }}>
                        Start here
                      </div>
                    )}
                  </div>

                  {/* Badge: MANDATORY on first, lock on rest */}
                  {isCurrent ? (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, color: 'var(--blue)',
                      background: '#BBDEFB', padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                    }}>
                      MANDATORY
                    </span>
                  ) : (
                    <span style={{ marginLeft: 'auto', fontSize: 14 }}>🔒</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {showRoles && <RolesHelpPanel onClose={() => setShowRoles(false)} />}
      </>
    )
  }

  // ── In-progress wizard + roles button ────────────────────────────────────
  return (
    <>
      {!wizardDismissed && !allDone && (
        <OnboardingWizard
          currentStep={setupStep}
          onDismiss={() => setWizardDismissed(true)}
          config={config}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowRoles(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          🔑 Roles &amp; Responsibilities
        </button>
      </div>

      {showRoles && <RolesHelpPanel onClose={() => setShowRoles(false)} />}
    </>
  )
}

'use client'

import Link from 'next/link'
import { getActiveSetupSteps } from '@/lib/hospitalConfig'
import type { HospitalConfig } from '@/lib/hospitalConfig'

interface Props {
  config: HospitalConfig
  setupStep: number
}

export function SetupProgressCard({ config, setupStep }: Props) {
  const activeSteps = getActiveSetupSteps(config)
  const total = activeSteps.length
  if (total === 0) return null

  const completed = setupStep >= total ? total : setupStep
  const pct = Math.round((completed / total) * 100)
  const allDone = completed >= total
  const nextStep = allDone ? null : activeSteps[completed]

  return (
    <div style={{
      border: allDone ? '1px solid #C8E6C9' : '1px solid var(--gray-200)',
      background: allDone ? '#F1F8E9' : 'white',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {allDone ? '🎉' : '🚀'} Setup Progress
            {allDone && <span style={{ fontSize: '0.75rem', background: '#C8E6C9', color: '#2E7D32', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Complete!</span>}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginTop: 2 }}>
            {completed} / {total} steps completed ({pct}%)
          </div>
        </div>
        {nextStep && (
          <Link href={nextStep.href} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            {nextStep.icon} {nextStep.label} →
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: allDone ? '#4CAF50' : pct > 60 ? 'var(--blue)' : pct > 30 ? '#FF9800' : '#EF5350',
          borderRadius: 99,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Step checklist */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {activeSteps.map((step, idx) => {
          const done = idx < completed
          const isCurrent = idx === completed
          return (
            <div
              key={step.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99,
                background: done ? '#E8F5E9' : isCurrent ? '#EBF5FB' : 'var(--gray-50)',
                border: done ? '1px solid #C8E6C9' : isCurrent ? '1px solid #BBDEFB' : '1px solid var(--gray-200)',
                fontSize: '0.78rem',
                fontWeight: isCurrent ? 700 : done ? 600 : 400,
                color: done ? '#2E7D32' : isCurrent ? 'var(--blue)' : 'var(--gray-400)',
              }}
            >
              <span>{done ? '✔' : isCurrent ? '→' : '○'}</span>
              <span>{step.icon} {step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

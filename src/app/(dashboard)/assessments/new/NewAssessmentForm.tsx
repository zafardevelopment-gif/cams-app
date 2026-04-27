'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAssessment } from '@/actions/assessments'
import { toast } from 'sonner'

interface Template { id: string; title: string; category: string }
interface Assessor { id: string; full_name: string }

export function NewAssessmentForm({
  templates,
  assessors,
  defaultTemplateId,
}: {
  templates: Template[]
  assessors: Assessor[]
  defaultTemplateId?: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplateId ?? '')

  async function handleSubmit(formData: FormData) {
    formData.set('template_id', selectedTemplate)
    startTransition(async () => {
      const result = await createAssessment(formData)
      if (result.success && result.data) {
        toast.success('Assessment created!')
        router.push(`/assessments/${result.data.id}`)
      } else {
        toast.error(result.error ?? 'Failed to create assessment')
      }
    })
  }

  const categories = [...new Set(templates.map((t) => t.category))]

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Start New Assessment</h1>
          <p>Select a competency template to begin</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Template Selection */}
        <div className="card">
          <div className="card-header"><div className="card-title">Select Competency</div></div>
          <div className="card-body">
            {categories.map((cat) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{cat}</div>
                {templates.filter((t) => t.category === cat).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                      border: `1.5px solid ${selectedTemplate === t.id ? 'var(--blue)' : 'var(--gray-200)'}`,
                      background: selectedTemplate === t.id ? '#E3F2FD' : 'white',
                      transition: 'all 0.14s',
                    }}
                  >
                    <div style={{ fontWeight: selectedTemplate === t.id ? 600 : 500, color: 'var(--navy)', fontSize: 13 }}>
                      {selectedTemplate === t.id ? '● ' : '○ '}{t.title}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Assessment Config */}
        <div className="card">
          <div className="card-header"><div className="card-title">Assessment Details</div></div>
          <div className="card-body">
            <form action={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Assign Assessor</label>
                <select name="assessor_id" className="form-control">
                  <option value="">Select assessor (optional)</option>
                  {assessors.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input name="due_date" type="date" className="form-control" />
              </div>

              {selectedTemplate ? (
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  ✓ Template selected: <strong>{templates.find((t) => t.id === selectedTemplate)?.title}</strong>
                </div>
              ) : (
                <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                  ⚠️ Please select a competency template from the left
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={isPending || !selectedTemplate}
              >
                {isPending ? '⏳ Creating…' : '▶ Start Assessment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { autosaveAssessment, submitAssessmentV2 } from '@/actions/assessments'
import type { KnowledgeSection, QuizQuestion, QuestionType } from '@/types'

// ── types ─────────────────────────────────────────────────────────────────────

interface Props {
  assessmentId: string
  template: {
    title: string
    passing_score: number
    requires_knowledge: boolean
    requires_quiz: boolean
    requires_practical: boolean
    knowledge_sections: KnowledgeSection[]
    quiz_questions: QuizQuestion[]
  }
  initialDraft?: Record<string, unknown>
}

type Step = 'knowledge' | 'quiz' | 'review' | 'done'

// ── helpers ───────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 15000

function QuestionBlock({
  q, idx, answer, onChange,
}: {
  q: QuizQuestion; idx: number
  answer: unknown; onChange: (v: unknown) => void
}) {
  const type: QuestionType = q.type ?? 'mcq'

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
        <span style={{ minWidth: 26, height: 26, borderRadius: '50%', background: 'var(--blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy)', margin: 0, lineHeight: 1.6 }}>{q.question}</p>
      </div>

      {(type === 'mcq' || type === 'true_false') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 36 }}>
          {(type === 'true_false' ? ['True', 'False'] : q.options).map((opt, i) => (
            <label key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
              cursor: 'pointer', border: `1.5px solid ${answer === i ? 'var(--blue)' : 'var(--gray-200)'}`,
              background: answer === i ? '#EBF4FF' : 'white', transition: 'all 0.12s',
            }}>
              <input type="radio" name={`q-${q.id}`} checked={answer === i}
                onChange={() => onChange(i)} style={{ display: 'none' }} />
              <span style={{
                width: 18, height: 18, borderRadius: '50%', border: `2px solid ${answer === i ? 'var(--blue)' : 'var(--gray-300)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {answer === i && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />}
              </span>
              <span style={{ fontSize: 13 }}>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {type === 'short_answer' && (
        <textarea className="form-control" rows={3} style={{ marginLeft: 36, fontSize: 13 }}
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here…" />
      )}

      {type === 'rating' && (
        <div style={{ paddingLeft: 36, display: 'flex', gap: 8, alignItems: 'center' }}>
          {Array.from({ length: q.max_score ?? 5 }, (_, i) => i + 1).map((val) => (
            <button key={val} type="button" onClick={() => onChange(val)} style={{
              width: 40, height: 40, borderRadius: 8, border: `2px solid ${answer === val ? 'var(--blue)' : 'var(--gray-200)'}`,
              background: answer === val ? 'var(--blue)' : 'white', color: answer === val ? 'white' : 'var(--gray-600)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>{val}</button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 4 }}>/ {q.max_score ?? 5}</span>
        </div>
      )}

      {type === 'checklist' && (
        <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const checked = Array.isArray(answer) ? (answer as number[]).includes(i) : false
            return (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={checked} onChange={() => {
                  const cur = Array.isArray(answer) ? (answer as number[]) : []
                  onChange(checked ? cur.filter((x) => x !== i) : [...cur, i])
                }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export function TakeAssessmentClient({ assessmentId, template, initialDraft }: Props) {
  const [isPending, startTransition] = useTransition()

  // Determine steps
  const steps: Step[] = []
  if (template.requires_knowledge && template.knowledge_sections.length > 0) steps.push('knowledge')
  if (template.requires_quiz && template.quiz_questions.length > 0) steps.push('quiz')
  steps.push('review')

  const [stepIdx, setStepIdx] = useState(0)
  const currentStep = steps[stepIdx] ?? 'review'

  // Knowledge reading
  const [knowledgeSection, setKnowledgeSection] = useState(0)
  const [knowledgeRead, setKnowledgeRead] = useState<Record<string, boolean>>(
    (initialDraft?.knowledge_read as Record<string, boolean>) ?? {}
  )

  // Quiz answers — keyed by question id
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    (initialDraft?.quiz_responses as Record<string, unknown>) ?? {}
  )

  // Autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string | null>(null)

  function scheduleAutosave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      const payload = { quiz_responses: answers, knowledge_read: knowledgeRead }
      const snapshot = JSON.stringify(payload)
      if (snapshot === lastSaved.current) return
      lastSaved.current = snapshot
      startTransition(async () => {
        await autosaveAssessment(assessmentId, payload)
      })
    }, AUTOSAVE_MS)
  }

  useEffect(() => {
    scheduleAutosave()
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, knowledgeRead])

  function setAnswer(qId: string, val: unknown) {
    setAnswers((prev) => ({ ...prev, [qId]: val }))
  }

  const sections = template.knowledge_sections
  const questions = template.quiz_questions
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length
  const requiredCount = questions.filter((q) => q.required !== false).length

  function handleSubmit() {
    if (answeredCount < requiredCount) {
      toast.error(`Please answer all required questions (${answeredCount}/${requiredCount})`)
      return
    }
    startTransition(async () => {
      const r = await submitAssessmentV2(assessmentId, {
        quiz_responses: answers,
        knowledge_responses_v2: knowledgeRead,
      })
      if (r.success) {
        setStepIdx(steps.indexOf('review') !== -1 ? steps.length : steps.length)
        toast.success('Assessment submitted!')
      } else {
        toast.error(r.error ?? 'Submission failed')
      }
    })
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (currentStep === 'done' || (stepIdx >= steps.length && steps[steps.length - 1] === 'review')) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Submitted!</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>Your assessment has been submitted for review. You'll be notified of the outcome.</p>
        <a href="/assessments" className="btn btn-primary">Back to Assessments</a>
      </div>
    )
  }

  // ── Progress bar ────────────────────────────────────────────────────────────
  const progressPct = steps.length <= 1 ? 100 : Math.round((stepIdx / (steps.length - 1)) * 100)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Progress header */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--navy)' }}>{template.title}</div>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            {isPending ? 'Saving…' : 'Draft saved'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= stepIdx ? 'var(--blue)' : 'var(--gray-200)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          Step {stepIdx + 1} of {steps.length}: <strong style={{ textTransform: 'capitalize' }}>{currentStep === 'knowledge' ? 'Study Material' : currentStep === 'quiz' ? 'Quiz' : 'Review & Submit'}</strong>
        </div>
      </div>

      {/* ── Knowledge reading step ───────────────────────────────────────────── */}
      {currentStep === 'knowledge' && (
        <div>
          {sections.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {sections.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setKnowledgeSection(i)}
                  className={`btn btn-sm ${i === knowledgeSection ? 'btn-primary' : 'btn-secondary'}`}>
                  {i + 1}. {s.title.slice(0, 20)}{s.title.length > 20 ? '…' : ''}
                  {knowledgeRead[s.id] && ' ✓'}
                </button>
              ))}
            </div>
          )}

          {sections[knowledgeSection] && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: 'var(--navy)', marginBottom: 16, fontSize: 16 }}>
                {sections[knowledgeSection].title}
              </h3>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
                {sections[knowledgeSection].content}
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={!!knowledgeRead[sections[knowledgeSection].id]}
                    onChange={(e) => setKnowledgeRead((prev) => ({ ...prev, [sections[knowledgeSection].id]: e.target.checked }))}
                  />
                  I have read this section
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {knowledgeSection > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setKnowledgeSection((i) => i - 1)}>← Prev</button>
                  )}
                  {knowledgeSection < sections.length - 1 ? (
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      setKnowledgeRead((prev) => ({ ...prev, [sections[knowledgeSection].id]: true }))
                      setKnowledgeSection((i) => i + 1)
                    }}>Next →</button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => setStepIdx((i) => i + 1)}>
                      Continue to Quiz →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quiz step ────────────────────────────────────────────────────────── */}
      {currentStep === 'quiz' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {answeredCount} / {questions.length} answered
              {requiredCount < questions.length && ` (${requiredCount} required)`}
            </p>
            {steps.includes('knowledge') && (
              <button className="btn btn-secondary btn-sm" onClick={() => setStepIdx(steps.indexOf('knowledge'))}>
                ← Review Study Material
              </button>
            )}
          </div>

          {questions.map((q, i) => (
            <QuestionBlock key={q.id} q={q} idx={i} answer={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)} />
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => setStepIdx((i) => i + 1)}
              disabled={answeredCount < requiredCount}>
              Review & Submit →
            </button>
          </div>
          {answeredCount < requiredCount && (
            <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, textAlign: 'center' }}>
              {requiredCount - answeredCount} required question{requiredCount - answeredCount !== 1 ? 's' : ''} unanswered
            </p>
          )}
        </div>
      )}

      {/* ── Review & submit step ─────────────────────────────────────────────── */}
      {currentStep === 'review' && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ color: 'var(--navy)', marginBottom: 16 }}>Review Your Submission</h3>

            {template.requires_knowledge && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>📖 Knowledge Sections</div>
                {sections.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: knowledgeRead[s.id] ? 'var(--green)' : 'var(--gray-400)', marginBottom: 4 }}>
                    {knowledgeRead[s.id] ? '✓' : '○'} {s.title}
                  </div>
                ))}
              </div>
            )}

            {template.requires_quiz && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>📝 Quiz</div>
                <div style={{ fontSize: 13 }}>{answeredCount} / {questions.length} questions answered</div>
                {answeredCount < requiredCount && (
                  <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>
                    ⚠ {requiredCount - answeredCount} required question{requiredCount - answeredCount !== 1 ? 's' : ''} still unanswered
                  </div>
                )}
              </div>
            )}

            {template.requires_practical && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #f59e0b' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🤲 Practical Evaluation</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Practical checklist will be completed by your evaluator during the session.</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStepIdx((i) => i - 1)}>
              ← Back
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={handleSubmit}
              disabled={isPending || answeredCount < requiredCount}>
              {isPending ? 'Submitting…' : '✓ Submit Assessment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

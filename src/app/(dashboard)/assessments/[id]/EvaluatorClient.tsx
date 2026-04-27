'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { evaluatorReview } from '@/actions/assessments'
import type { QuizQuestion, PracticalItem } from '@/types'

interface Props {
  assessmentId: string
  staffName: string
  template: {
    title: string
    passing_score: number
    requires_knowledge: boolean
    requires_quiz: boolean
    requires_practical: boolean
    quiz_questions: QuizQuestion[]
    practical_checklist: PracticalItem[]
  }
  assessment: {
    quiz_auto_score?: number
    knowledge_responses_v2?: Record<string, unknown>
    quiz_responses?: Record<string, unknown>
    practical_results?: Record<string, { done: boolean }>
    evaluator_notes?: string
  }
}

export function EvaluatorClient({ assessmentId, staffName, template, assessment }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'quiz' | 'practical' | 'scores'>('quiz')

  // Scores
  const [knowledgeScore, setKnowledgeScore] = useState<string>('')
  const [quizScore, setQuizScore] = useState<string>(
    assessment.quiz_auto_score != null ? String(assessment.quiz_auto_score) : ''
  )
  const [practicalScore, setPracticalScore] = useState<string>('')
  const [evaluatorNotes, setEvaluatorNotes] = useState(assessment.evaluator_notes ?? '')

  // Practical checklist
  const [practicalResults, setPracticalResults] = useState<Record<string, { done: boolean }>>(
    assessment.practical_results ?? {}
  )
  const [practicalScores, setPracticalScores] = useState<Record<string, { done: boolean; score?: number }>>({})

  const quizResponses = assessment.quiz_responses ?? {}
  const questions = template.quiz_questions ?? []
  const checklist = template.practical_checklist ?? []

  const criticalItems = checklist.filter((i) => i.is_critical)
  const criticalFailed = criticalItems.some((i) => !practicalResults[i.id]?.done)

  function togglePractical(itemId: string, done: boolean) {
    setPracticalResults((prev) => ({ ...prev, [itemId]: { done } }))
    // Auto-score: count done / total
    const updated = { ...practicalResults, [itemId]: { done } }
    const total = checklist.length
    if (total > 0) {
      const doneCount = checklist.filter((i) => updated[i.id]?.done).length
      setPracticalScore(String(Math.round((doneCount / total) * 100)))
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const r = await evaluatorReview(assessmentId, {
        knowledge_score: knowledgeScore ? Number(knowledgeScore) : undefined,
        quiz_score:       quizScore ? Number(quizScore) : undefined,
        practical_score:  practicalScore ? Number(practicalScore) : undefined,
        practical_scores: practicalScores,
        practical_results: practicalResults,
        evaluator_notes:  evaluatorNotes,
      })
      if (r.success) {
        toast.success('Evaluation submitted — assessment sent for approval')
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Submission failed')
      }
    })
  }

  const TABS = [
    { key: 'quiz',      label: `Quiz Review ${questions.length > 0 ? `(${questions.length}q)` : ''}`, show: template.requires_quiz },
    { key: 'practical', label: `Practical ${checklist.length > 0 ? `(${checklist.length})` : ''}`, show: template.requires_practical },
    { key: 'scores',    label: 'Scores & Notes', show: true },
  ].filter((t) => t.show) as { key: string; label: string }[]

  return (
    <div>
      <div style={{ background: '#EBF8FF', border: '1px solid #90CDF4', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13 }}>
        <strong>Evaluator Mode</strong> — reviewing <strong>{staffName}</strong>'s submission for <strong>{template.title}</strong>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-200)', marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as typeof activeTab)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: 'none',
            borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
            color: activeTab === tab.key ? 'var(--blue)' : 'var(--gray-600)', marginBottom: -2,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Quiz review ─────────────────────────────────────────────────────── */}
      {activeTab === 'quiz' && (
        <div>
          {assessment.quiz_auto_score != null && (
            <div style={{ background: '#F0FFF4', border: '1px solid #68D391', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
              Auto-scored MCQ/T-F: <strong>{assessment.quiz_auto_score}%</strong> — you can override in the Scores tab.
            </div>
          )}
          {questions.length === 0
            ? <p className="text-muted text-sm">No quiz questions.</p>
            : questions.map((q, i) => {
              const ans = quizResponses[q.id]
              const type = q.type ?? 'mcq'
              const isCorrect = (type === 'mcq' || type === 'true_false') && ans === q.correct_index
              const isWrong   = (type === 'mcq' || type === 'true_false') && ans !== undefined && ans !== q.correct_index
              return (
                <div key={q.id} className="card" style={{ padding: 16, marginBottom: 10, borderLeft: `3px solid ${isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--gray-200)'}` }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-500)', flexShrink: 0 }}>Q{i + 1}</span>
                    <p style={{ fontSize: 13, margin: 0, flex: 1 }}>{q.question}</p>
                    {(type === 'mcq' || type === 'true_false') && (
                      <span className={`badge ${isCorrect ? 'badge-green' : isWrong ? 'badge-red' : 'badge-gray'}`} style={{ flexShrink: 0, fontSize: 11 }}>
                        {isCorrect ? '✓ Correct' : isWrong ? '✗ Wrong' : '—'}
                      </span>
                    )}
                  </div>
                  {(type === 'mcq' || type === 'true_false') && (
                    <div style={{ paddingLeft: 20, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(type === 'true_false' ? ['True', 'False'] : q.options).map((opt, j) => (
                        <div key={j} style={{
                          padding: '6px 10px', borderRadius: 6,
                          background: j === q.correct_index ? '#F0FFF4' : j === ans ? '#FFF5F5' : 'var(--gray-50)',
                          border: `1px solid ${j === q.correct_index ? '#68D391' : j === ans && j !== q.correct_index ? '#FC8181' : 'var(--gray-200)'}`,
                        }}>
                          {opt}
                          {j === q.correct_index && <span style={{ color: 'var(--green)', marginLeft: 8, fontSize: 10, fontWeight: 700 }}>✓ Correct answer</span>}
                          {j === ans && j !== q.correct_index && <span style={{ color: 'var(--red)', marginLeft: 8, fontSize: 10 }}>Staff's answer</span>}
                          {j === ans && j === q.correct_index && <span style={{ color: 'var(--blue)', marginLeft: 8, fontSize: 10 }}>Staff's answer</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {type === 'short_answer' && (
                    <div style={{ paddingLeft: 20, fontSize: 13 }}>
                      <div style={{ color: 'var(--gray-500)', marginBottom: 4 }}>Staff answer:</div>
                      <div style={{ padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                        {typeof ans === 'string' ? ans : <em style={{ color: 'var(--gray-400)' }}>No answer provided</em>}
                      </div>
                      {q.correct_answer && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)' }}>Model answer: {q.correct_answer}</div>
                      )}
                    </div>
                  )}
                  {type === 'rating' && (
                    <div style={{ paddingLeft: 20, fontSize: 13 }}>
                      Rating given: <strong>{ans != null ? String(ans) : '—'}</strong> / {q.max_score ?? 5}
                    </div>
                  )}
                  {q.explanation && (
                    <div style={{ marginTop: 8, paddingLeft: 20, fontSize: 12, color: 'var(--gray-500)', fontStyle: 'italic' }}>
                      Explanation: {q.explanation}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── Practical checklist ──────────────────────────────────────────────── */}
      {activeTab === 'practical' && (
        <div>
          {criticalFailed && criticalItems.length > 0 && (
            <div style={{ background: '#FFF5F5', border: '1px solid #FC8181', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#C53030' }}>
              ⚠ One or more <strong>critical</strong> items are not marked as done — this will result in a failed practical.
            </div>
          )}
          {checklist.length === 0
            ? <p className="text-muted text-sm">No practical items defined.</p>
            : checklist.map((item, i) => {
              const done = !!practicalResults[item.id]?.done
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: done ? '#F0FFF4' : 'white', borderRadius: 8, marginBottom: 8,
                  border: `1px solid ${done ? '#68D391' : item.is_critical ? '#FC8181' : 'var(--gray-200)'}`,
                }}>
                  <button type="button" onClick={() => togglePractical(item.id, !done)} style={{
                    width: 24, height: 24, borderRadius: 6, border: `2px solid ${done ? 'var(--green)' : 'var(--gray-300)'}`,
                    background: done ? 'var(--green)' : 'white', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                  }}>{done ? '✓' : ''}</button>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: done ? 500 : 400 }}>{item.item}</span>
                    {item.category && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)' }}>{item.category}</span>}
                  </div>
                  {item.is_critical && <span className="badge badge-red" style={{ fontSize: 10, flexShrink: 0 }}>Critical</span>}
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', flexShrink: 0 }}>{i + 1}/{checklist.length}</span>
                </div>
              )
            })
          }
          {checklist.length > 0 && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--gray-50)', fontSize: 13 }}>
              {checklist.filter((i) => practicalResults[i.id]?.done).length} / {checklist.length} items completed
              {criticalItems.length > 0 && ` · ${criticalItems.filter((i) => practicalResults[i.id]?.done).length}/${criticalItems.length} critical`}
            </div>
          )}
        </div>
      )}

      {/* ── Scores & notes ───────────────────────────────────────────────────── */}
      {activeTab === 'scores' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {template.requires_knowledge && (
              <div className="card">
                <div className="card-header"><div className="card-title">📖 Knowledge Score</div></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Score (0–100)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" className="form-control" min={0} max={100}
                        value={knowledgeScore}
                        onChange={(e) => setKnowledgeScore(e.target.value)}
                        placeholder="Enter score" style={{ maxWidth: 120 }} />
                      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {template.requires_quiz && (
              <div className="card">
                <div className="card-header"><div className="card-title">📝 Quiz Score</div></div>
                <div className="card-body">
                  {assessment.quiz_auto_score != null && (
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Auto-score: {assessment.quiz_auto_score}%</p>
                  )}
                  <div className="form-group">
                    <label className="form-label">Override Score (0–100)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" className="form-control" min={0} max={100}
                        value={quizScore}
                        onChange={(e) => setQuizScore(e.target.value)}
                        placeholder={assessment.quiz_auto_score != null ? `Auto: ${assessment.quiz_auto_score}` : 'Enter score'}
                        style={{ maxWidth: 120 }} />
                      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {template.requires_practical && (
              <div className="card">
                <div className="card-header"><div className="card-title">🤲 Practical Score</div></div>
                <div className="card-body">
                  {criticalFailed && (
                    <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠ Critical item incomplete — override to 0 recommended</p>
                  )}
                  <div className="form-group">
                    <label className="form-label">Score (0–100)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" className="form-control" min={0} max={100}
                        value={practicalScore}
                        onChange={(e) => setPracticalScore(e.target.value)}
                        placeholder="Auto-calculated from checklist"
                        style={{ maxWidth: 120 }} />
                      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Evaluator Notes</div></div>
              <div className="card-body">
                <textarea className="form-control" rows={6}
                  value={evaluatorNotes}
                  onChange={(e) => setEvaluatorNotes(e.target.value)}
                  placeholder="Observations, feedback, areas for improvement…" />
              </div>
            </div>

            {/* Score preview */}
            {(knowledgeScore || quizScore || practicalScore) && (() => {
              const vals = [knowledgeScore, quizScore, practicalScore].filter(Boolean).map(Number).filter((n) => !isNaN(n))
              const overall = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
              return overall != null ? (
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Projected Overall</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: overall >= template.passing_score ? 'var(--green)' : 'var(--red)' }}>
                    {overall}%
                  </div>
                  <div style={{ fontSize: 12, color: overall >= template.passing_score ? 'var(--green)' : 'var(--red)' }}>
                    {overall >= template.passing_score ? `✓ Above passing (${template.passing_score}%)` : `✗ Below passing (${template.passing_score}%)`}
                  </div>
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* Submit evaluation */}
      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }}
          onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Submitting…' : '✓ Submit Evaluation & Send for Approval'}
        </button>
      </div>
    </div>
  )
}

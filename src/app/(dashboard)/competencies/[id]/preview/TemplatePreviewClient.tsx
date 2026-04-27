'use client'

import { useState } from 'react'
import type { KnowledgeSection, QuizQuestion, PracticalItem, QuestionType } from '@/types'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq:          'Multiple Choice',
  true_false:   'True / False',
  short_answer: 'Short Answer',
  rating:       'Rating Scale',
  checklist:    'Checklist',
}

interface TemplateData {
  id: string
  title: string
  category: string
  subcategory?: string
  description?: string
  passing_score: number
  validity_months: number
  approval_levels: number
  is_mandatory: boolean
  is_draft: boolean
  version: number
  tags: string[]
  requires_knowledge: boolean
  requires_quiz: boolean
  requires_practical: boolean
  knowledge_sections: KnowledgeSection[]
  quiz_questions: QuizQuestion[]
  practical_checklist: PracticalItem[]
}

export function TemplatePreviewClient({ template: t }: { template: TemplateData }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'knowledge' | 'quiz' | 'practical'>('overview')

  const TABS = [
    { key: 'overview',  label: 'Overview' },
    { key: 'knowledge', label: `Knowledge (${t.knowledge_sections?.length ?? 0})`, show: t.requires_knowledge },
    { key: 'quiz',      label: `Quiz (${t.quiz_questions?.length ?? 0})`, show: t.requires_quiz },
    { key: 'practical', label: `Practical (${t.practical_checklist?.length ?? 0})`, show: t.requires_practical },
  ].filter((tab) => tab.key === 'overview' || tab.show) as { key: string; label: string }[]

  const sections: KnowledgeSection[] = t.knowledge_sections ?? []
  const questions: QuizQuestion[] = t.quiz_questions ?? []
  const checklist: PracticalItem[] = t.practical_checklist ?? []
  const criticalCount = checklist.filter((i) => i.is_critical).length

  return (
    <div>
      {t.is_draft && (
        <div style={{ background: '#FFFBEB', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e' }}>
          <strong>Draft</strong> — this template is not yet visible to staff.
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-200)', marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as typeof activeTab)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: 'none',
            borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
            color: activeTab === tab.key ? 'var(--blue)' : 'var(--gray-600)',
            marginBottom: -2,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Details</div></div>
              <div className="card-body">
                {t.description && <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 16, lineHeight: 1.7 }}>{t.description}</p>}
                <div className="stat-row"><span className="stat-label">Category</span><span className="stat-value">{t.category}{t.subcategory ? ` / ${t.subcategory}` : ''}</span></div>
                <div className="stat-row"><span className="stat-label">Passing Score</span><span className="stat-value">{t.passing_score}%</span></div>
                <div className="stat-row"><span className="stat-label">Certificate Valid For</span><span className="stat-value">{t.validity_months} months</span></div>
                <div className="stat-row"><span className="stat-label">Approval Levels</span><span className="stat-value">{t.approval_levels}</span></div>
                <div className="stat-row"><span className="stat-label">Type</span><span className={`badge ${t.is_mandatory ? 'badge-red' : 'badge-gray'}`}>{t.is_mandatory ? 'Mandatory' : 'Optional'}</span></div>
                <div className="stat-row"><span className="stat-label">Version</span><span className="stat-value">v{t.version}</span></div>
              </div>
            </div>

            {t.tags && t.tags.length > 0 && (
              <div className="card">
                <div className="card-header"><div className="card-title">Tags</div></div>
                <div className="card-body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {t.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--gray-100)', border: '1px solid var(--gray-200)' }}>#{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Assessment Components</div></div>
              <div className="card-body">
                {t.requires_knowledge && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span style={{ fontWeight: 500 }}>📖 Knowledge Assessment</span>
                    <span className="badge badge-blue">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {t.requires_quiz && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span style={{ fontWeight: 500 }}>📝 Quiz</span>
                    <span className="badge badge-purple">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {t.requires_practical && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                    <span style={{ fontWeight: 500 }}>🤲 Practical Checklist</span>
                    <span className="badge badge-teal">{checklist.length} items ({criticalCount} critical)</span>
                  </div>
                )}
                {!t.requires_knowledge && !t.requires_quiz && !t.requires_practical && (
                  <p className="text-muted text-sm">No assessment components defined.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge sections */}
      {activeTab === 'knowledge' && (
        <div>
          {sections.length === 0
            ? <p className="text-muted text-sm">No knowledge sections defined.</p>
            : sections.map((s, i) => (
              <div key={s.id} className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div className="card-title">Section {i + 1}: {s.title}</div>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--gray-700)' }}>{s.content}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Quiz questions */}
      {activeTab === 'quiz' && (
        <div>
          {questions.length === 0
            ? <p className="text-muted text-sm">No quiz questions defined.</p>
            : questions.map((q, i) => (
              <div key={q.id} className="card" style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Q{i + 1}. {q.question}</div>
                  <span className="badge badge-gray" style={{ fontSize: 11, flexShrink: 0, marginLeft: 8 }}>{QUESTION_TYPE_LABELS[q.type ?? 'mcq']}</span>
                </div>

                {(q.type === 'mcq' || q.type === 'true_false') && q.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt, j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                        background: j === q.correct_index ? '#F0FFF4' : 'var(--gray-50)',
                        border: `1px solid ${j === q.correct_index ? '#68D391' : 'var(--gray-200)'}`,
                      }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: j === q.correct_index ? 'var(--green)' : 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: j === q.correct_index ? 'white' : 'var(--gray-500)', flexShrink: 0 }}>
                          {String.fromCharCode(65 + j)}
                        </span>
                        {opt}
                        {j === q.correct_index && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Correct</span>}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'short_answer' && q.correct_answer && (
                  <div style={{ padding: '8px 12px', borderRadius: 6, background: '#F0FFF4', border: '1px solid #68D391', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>Model answer:</span> {q.correct_answer}
                  </div>
                )}

                {q.type === 'rating' && (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Rating scale: 1 – {q.max_score ?? 5}</div>
                )}

                {q.explanation && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#EBF8FF', border: '1px solid #90CDF4', fontSize: 12, color: 'var(--gray-700)' }}>
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* Practical checklist */}
      {activeTab === 'practical' && (
        <div>
          {checklist.length === 0
            ? <p className="text-muted text-sm">No practical items defined.</p>
            : (
              <>
                {criticalCount > 0 && (
                  <p className="text-sm" style={{ marginBottom: 16, color: 'var(--gray-600)' }}>
                    <span className="badge badge-red">{criticalCount} critical</span> items — failure on any critical step results in automatic fail.
                  </p>
                )}
                <div className="card">
                  <div className="card-body p-0">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Item</th><th>Category</th><th>Critical</th></tr>
                      </thead>
                      <tbody>
                        {checklist.map((item, i) => (
                          <tr key={item.id}>
                            <td className="text-sm text-muted">{i + 1}</td>
                            <td style={{ fontSize: 13 }}>{item.item}</td>
                            <td className="text-sm text-muted">{item.category || '—'}</td>
                            <td>{item.is_critical && <span className="badge badge-red">Critical</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { saveTemplateV2 } from '@/actions/competencies'
import type { QuizQuestion, KnowledgeSection, PracticalItem, QuestionType, TemplateHistory } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const CATEGORIES = [
  'Clinical Skills', 'Patient Safety', 'Infection Control',
  'Medication Management', 'Emergency Response', 'Documentation',
  'Leadership', 'Communication', 'Other',
]

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq:          'Multiple Choice (MCQ)',
  true_false:   'True / False',
  short_answer: 'Short Answer',
  rating:       'Rating Scale',
  checklist:    'Checklist',
}

// ── sub-components ────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim().toLowerCase().replace(/\s+/g, '-')
    if (v && !tags.includes(v) && tags.length < 20) {
      onChange([...tags, v])
    }
    setInput('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tags.map((tag) => (
          <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 4 }}>
            #{tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="form-control"
          style={{ flex: 1 }}
          placeholder="Add tag (press Enter)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>Add</button>
      </div>
    </div>
  )
}

function QuestionEditor({ q, onChange, onRemove }: {
  q: QuizQuestion
  onChange: (q: QuizQuestion) => void
  onRemove: () => void
}) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, background: 'var(--gray-50)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <textarea
            className="form-control"
            rows={2}
            value={q.question}
            onChange={(e) => onChange({ ...q, question: e.target.value })}
            placeholder="Question text…"
            style={{ fontSize: 13 }}
          />
        </div>
        <select
          className="form-control"
          style={{ width: 170, fontSize: 12, flexShrink: 0 }}
          value={q.type}
          onChange={(e) => onChange({ ...q, type: e.target.value as QuestionType, options: [], correct_index: 0 })}
        >
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button type="button" className="btn btn-danger btn-sm" onClick={onRemove} style={{ flexShrink: 0 }}>✕</button>
      </div>

      {/* MCQ / true_false options */}
      {(q.type === 'mcq' || q.type === 'true_false') && (
        <div style={{ marginBottom: 8 }}>
          {q.type === 'true_false'
            ? (
              <div style={{ display: 'flex', gap: 12 }}>
                {['True', 'False'].map((opt, i) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" name={`tf-${q.id}`} checked={q.correct_index === i}
                      onChange={() => onChange({ ...q, options: ['True', 'False'], correct_index: i })} />
                    {opt} (correct)
                  </label>
                ))}
              </div>
            )
            : (
              <>
                {q.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input type="radio" name={`correct-${q.id}`} checked={q.correct_index === i}
                      onChange={() => onChange({ ...q, correct_index: i })}
                      title="Mark as correct answer" />
                    <input
                      className="form-control"
                      style={{ flex: 1, fontSize: 12 }}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...q.options]; opts[i] = e.target.value
                        onChange({ ...q, options: opts })
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    <button type="button" style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}
                      onClick={() => {
                        const opts = q.options.filter((_, j) => j !== i)
                        onChange({ ...q, options: opts, correct_index: Math.min(q.correct_index, opts.length - 1) })
                      }}>✕</button>
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => onChange({ ...q, options: [...q.options, ''] })}>
                    ＋ Add Option
                  </button>
                )}
              </>
            )
          }
        </div>
      )}

      {/* Short answer — correct answer hint */}
      {q.type === 'short_answer' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: 11 }}>Expected answer (for reference)</label>
          <input className="form-control" style={{ fontSize: 12 }} value={q.correct_answer ?? ''}
            onChange={(e) => onChange({ ...q, correct_answer: e.target.value })}
            placeholder="Model answer…" />
        </div>
      )}

      {/* Rating — max score */}
      {q.type === 'rating' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <label>Max score:</label>
          <input type="number" className="form-control" style={{ width: 80, fontSize: 12 }}
            value={q.max_score ?? 5} min={1} max={10}
            onChange={(e) => onChange({ ...q, max_score: Number(e.target.value) })} />
        </div>
      )}

      {/* Explanation */}
      <div style={{ marginTop: 8 }}>
        <input className="form-control" style={{ fontSize: 12 }} value={q.explanation ?? ''}
          onChange={(e) => onChange({ ...q, explanation: e.target.value })}
          placeholder="Explanation (optional, shown after submission)" />
      </div>
    </div>
  )
}

function KnowledgeSectionEditor({ s, onChange, onRemove }: {
  s: KnowledgeSection; onChange: (s: KnowledgeSection) => void; onRemove: () => void
}) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, background: 'var(--gray-50)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input className="form-control" style={{ flex: 1, fontWeight: 600 }} value={s.title}
          onChange={(e) => onChange({ ...s, title: e.target.value })} placeholder="Section title…" />
        <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>
      </div>
      <textarea className="form-control" rows={4} value={s.content}
        onChange={(e) => onChange({ ...s, content: e.target.value })}
        placeholder="Section content — study material, instructions, or reference text…"
        style={{ fontSize: 13 }} />
    </div>
  )
}

function PracticalItemEditor({ item, onChange, onRemove }: {
  item: PracticalItem; onChange: (i: PracticalItem) => void; onRemove: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <input type="checkbox" checked={item.is_critical}
        onChange={(e) => onChange({ ...item, is_critical: e.target.checked })}
        title="Mark as critical step" />
      <input className="form-control" style={{ flex: 1, fontSize: 13 }} value={item.item}
        onChange={(e) => onChange({ ...item, item: e.target.value })} placeholder="Checklist item…" />
      <input className="form-control" style={{ width: 120, fontSize: 12 }} value={item.category ?? ''}
        onChange={(e) => onChange({ ...item, category: e.target.value })} placeholder="Category" />
      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }} onClick={onRemove}>✕</button>
    </div>
  )
}

function HistoryTab({ history }: { history: TemplateHistory[] }) {
  if (history.length === 0) {
    return <p className="text-muted text-sm" style={{ padding: 24 }}>No edit history yet.</p>
  }
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Old Value</th><th>New Value</th><th>Version</th><th>Changed At</th></tr></thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}>
              <td className="text-sm" style={{ fontFamily: 'monospace' }}>{h.field_name}</td>
              <td className="text-sm text-muted">{h.old_value ?? '—'}</td>
              <td className="text-sm">{h.new_value ?? '—'}</td>
              <td className="text-sm">v{h.version}</td>
              <td className="text-sm text-muted">{new Date(h.changed_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

interface TemplateFormProps {
  mode: 'create' | 'edit'
  templateId?: string
  departments?: { id: string; name: string }[]
  units?: { id: string; name: string }[]
  history?: TemplateHistory[]
  defaultValues?: {
    title?: string; category?: string; subcategory?: string; description?: string
    passing_score?: number; validity_months?: number; approval_levels?: number
    requires_knowledge?: boolean; requires_quiz?: boolean; requires_practical?: boolean
    is_mandatory?: boolean; is_draft?: boolean; tags?: string[]
    department_id?: string; unit_id?: string
    knowledge_sections?: KnowledgeSection[]; quiz_questions?: QuizQuestion[]; practical_checklist?: PracticalItem[]
  }
}

export default function TemplateForm({
  mode, templateId, departments = [], units = [], history = [], defaultValues = {},
}: TemplateFormProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'basic' | 'knowledge' | 'quiz' | 'practical' | 'history'>('basic')

  // Basic fields
  const [title, setTitle]               = useState(defaultValues.title ?? '')
  const [category, setCategory]         = useState(defaultValues.category ?? '')
  const [subcategory, setSubcategory]   = useState(defaultValues.subcategory ?? '')
  const [description, setDescription]  = useState(defaultValues.description ?? '')
  const [passingScore, setPassingScore] = useState(defaultValues.passing_score ?? 80)
  const [validityMonths, setValidityMonths] = useState(defaultValues.validity_months ?? 12)
  const [approvalLevels, setApprovalLevels] = useState(defaultValues.approval_levels ?? 3)
  const [isMandatory, setIsMandatory]   = useState(defaultValues.is_mandatory ?? false)
  const [isDraft, setIsDraft]           = useState(mode === 'create' ? true : (defaultValues.is_draft ?? false))
  const [tags, setTags]                 = useState<string[]>(defaultValues.tags ?? [])
  const [departmentId, setDepartmentId] = useState(defaultValues.department_id ?? '')
  const [unitId, setUnitId]             = useState(defaultValues.unit_id ?? '')
  const [reqKnowledge, setReqKnowledge] = useState(defaultValues.requires_knowledge ?? true)
  const [reqQuiz, setReqQuiz]           = useState(defaultValues.requires_quiz ?? false)
  const [reqPractical, setReqPractical] = useState(defaultValues.requires_practical ?? false)

  // Content arrays
  const [sections, setSections]     = useState<KnowledgeSection[]>(defaultValues.knowledge_sections ?? [])
  const [questions, setQuestions]   = useState<QuizQuestion[]>(defaultValues.quiz_questions ?? [])
  const [checklist, setChecklist]   = useState<PracticalItem[]>(defaultValues.practical_checklist ?? [])

  function updateQuestion(id: string, updated: QuizQuestion) {
    setQuestions((qs) => qs.map((q) => q.id === id ? updated : q))
  }
  function updateSection(id: string, updated: KnowledgeSection) {
    setSections((ss) => ss.map((s) => s.id === id ? updated : s))
  }
  function updateItem(id: string, updated: PracticalItem) {
    setChecklist((cs) => cs.map((c) => c.id === id ? updated : c))
  }

  function handleSave(asDraft: boolean) {
    const payload = {
      title, category, subcategory, description,
      passing_score: passingScore, validity_months: validityMonths, approval_levels: approvalLevels,
      requires_knowledge: reqKnowledge, requires_quiz: reqQuiz, requires_practical: reqPractical,
      is_mandatory: isMandatory, is_draft: asDraft,
      tags, department_id: departmentId, unit_id: unitId,
      knowledge_sections: sections,
      quiz_questions: questions,
      practical_checklist: checklist,
    }
    startTransition(async () => {
      const r = await saveTemplateV2(templateId ?? null, payload)
      if (r.success) {
        toast.success(asDraft ? 'Saved as draft' : 'Template published')
        router.push('/competencies')
      } else {
        toast.error(r.error ?? 'Failed to save')
      }
    })
  }

  const TABS = [
    { key: 'basic',     label: 'Basic Info' },
    { key: 'knowledge', label: `Knowledge ${sections.length > 0 ? `(${sections.length})` : ''}`, disabled: !reqKnowledge },
    { key: 'quiz',      label: `Quiz ${questions.length > 0 ? `(${questions.length})` : ''}`, disabled: !reqQuiz },
    { key: 'practical', label: `Practical ${checklist.length > 0 ? `(${checklist.length})` : ''}`, disabled: !reqPractical },
    { key: 'history',   label: `History ${history.length > 0 ? `(${history.length})` : ''}`, disabled: mode === 'create' },
  ] as const

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-200)', marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={'disabled' in tab && !!tab.disabled}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none',
              cursor: ('disabled' in tab && tab.disabled) ? 'default' : 'pointer',
              background: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
              color: ('disabled' in tab && tab.disabled) ? 'var(--gray-300)' : activeTab === tab.key ? 'var(--blue)' : 'var(--gray-600)',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Basic Info tab ─────────────────────────────────────────────────── */}
      {activeTab === 'basic' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Basic Information</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Template Title *</label>
                  <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. IV Catheter Insertion" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required>
                    <option value="">Select category…</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subcategory</label>
                  <input className="form-control" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Optional subcategory" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the competency…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <TagInput tags={tags} onChange={setTags} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Scope (Optional)</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Restrict to Department</label>
                  <select className="form-control" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">All departments (hospital-wide)</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {units.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Restrict to Unit</label>
                    <select className="form-control" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                      <option value="">All units</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Assessment Components</div></div>
              <div className="card-body">
                {([
                  { label: '📖 Knowledge Assessment', desc: 'Study sections + written questions', state: reqKnowledge, set: setReqKnowledge },
                  { label: '📝 Quiz / MCQ', desc: 'Multiple choice, T/F, short answer, rating', state: reqQuiz, set: setReqQuiz },
                  { label: '🤲 Practical Evaluation', desc: 'Hands-on skills checklist', state: reqPractical, set: setReqPractical },
                ] as const).map((item, i) => (
                  <div key={i} onClick={() => item.set(!item.state)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8,
                    cursor: 'pointer', marginBottom: 8,
                    border: `1px solid ${item.state ? 'var(--blue)' : 'var(--gray-200)'}`,
                    background: item.state ? '#EBF4FF' : 'white',
                  }}>
                    <input type="checkbox" checked={item.state} onChange={() => {}} style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                      <div className="text-muted text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Scoring & Validity</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Passing Score (%)</label>
                  <input type="number" className="form-control" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Certificate Validity</label>
                  <select className="form-control" value={validityMonths} onChange={(e) => setValidityMonths(Number(e.target.value))}>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={24}>24 months</option>
                    <option value={36}>36 months</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Approval Levels</label>
                  <select className="form-control" value={approvalLevels} onChange={(e) => setApprovalLevels(Number(e.target.value))}>
                    <option value={2}>2 levels</option>
                    <option value={3}>3 levels (Standard)</option>
                    <option value={4}>4 levels</option>
                    <option value={5}>5 levels</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Settings</div></div>
              <div className="card-body">
                {[
                  { label: 'Mandatory Competency', desc: 'All staff must complete', state: isMandatory, set: setIsMandatory, color: 'var(--red)', bg: '#FFF5F5' },
                  { label: 'Save as Draft', desc: 'Hidden from staff until published', state: isDraft, set: setIsDraft, color: 'var(--amber, #f59e0b)', bg: '#FFFBEB' },
                ].map((item, i) => (
                  <div key={i} onClick={() => item.set(!item.state)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8,
                    cursor: 'pointer', marginBottom: 8,
                    border: `1px solid ${item.state ? item.color : 'var(--gray-200)'}`,
                    background: item.state ? item.bg : 'white',
                  }}>
                    <input type="checkbox" checked={item.state} onChange={() => {}} style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                      <div className="text-muted text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Knowledge tab ──────────────────────────────────────────────────── */}
      {activeTab === 'knowledge' && (
        <div>
          <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
            Add study sections staff will read before attempting the assessment.
          </p>
          {sections.map((s) => (
            <KnowledgeSectionEditor key={s.id} s={s}
              onChange={(updated) => updateSection(s.id, updated)}
              onRemove={() => setSections((ss) => ss.filter((x) => x.id !== s.id))} />
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() =>
            setSections((ss) => [...ss, { id: uid(), title: '', content: '', order: ss.length }])}>
            ＋ Add Section
          </button>
        </div>
      )}

      {/* ── Quiz tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'quiz' && (
        <div>
          <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
            Supports MCQ, True/False, Short Answer, Rating Scale, and Checklist questions.
          </p>
          {questions.map((q) => (
            <QuestionEditor key={q.id} q={q}
              onChange={(updated) => updateQuestion(q.id, updated)}
              onRemove={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} />
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <button key={type} type="button" className="btn btn-secondary btn-sm" onClick={() =>
                setQuestions((qs) => [...qs, {
                  id: uid(), question: '', type, options: type === 'mcq' ? ['', ''] : type === 'true_false' ? ['True', 'False'] : [],
                  correct_index: 0, required: true,
                }])}>
                ＋ {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Practical tab ──────────────────────────────────────────────────── */}
      {activeTab === 'practical' && (
        <div>
          <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
            Define checklist items. Check the box to mark an item as <strong>critical</strong> (failure = automatic fail).
          </p>
          {checklist.map((item) => (
            <PracticalItemEditor key={item.id} item={item}
              onChange={(updated) => updateItem(item.id, updated)}
              onRemove={() => setChecklist((cs) => cs.filter((x) => x.id !== item.id))} />
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() =>
            setChecklist((cs) => [...cs, { id: uid(), item: '', category: '', is_critical: false, order: cs.length }])}>
            ＋ Add Checklist Item
          </button>
        </div>
      )}

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && <HistoryTab history={history} />}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button type="button" className="btn btn-primary" disabled={isPending || !title || !category}
          onClick={() => handleSave(false)} style={{ minWidth: 150 }}>
          {isPending ? 'Saving…' : mode === 'create' ? '✓ Publish Template' : '💾 Save & Publish'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={isPending || !title || !category}
          onClick={() => handleSave(true)}>
          {isPending ? '…' : 'Save as Draft'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        {mode === 'edit' && templateId && (
          <Link href={`/competencies/${templateId}/preview`} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
            👁 Preview
          </Link>
        )}
      </div>
    </div>
  )
}

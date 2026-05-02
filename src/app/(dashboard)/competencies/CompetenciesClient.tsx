'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cloneTemplate, deleteTemplate, publishTemplate } from '@/actions/competencies'
import { CompetencyZeroState } from '@/components/onboarding/OnboardingComponents'

interface TemplateRow {
  id: string
  title: string
  category: string
  subcategory?: string
  description?: string
  passing_score: number
  validity_months: number
  approval_levels: number
  is_mandatory: boolean
  requires_knowledge: boolean
  requires_quiz: boolean
  requires_practical: boolean
  is_draft: boolean
  version: number
  tags: string[]
  cloned_from_id?: string
  department?: { id: string; name: string } | { id: string; name: string }[] | null
  unit?: { id: string; name: string } | { id: string; name: string }[] | null
}

interface Props {
  templates: TemplateRow[]
  departments: { id: string; name: string }[]
  canEdit: boolean
  canPreview?: boolean
}

function resolveJoin<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export function CompetenciesClient({ templates, departments, canEdit, canPreview = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [showDrafts, setShowDrafts] = useState(true)
  const [cloneTarget, setCloneTarget] = useState<TemplateRow | null>(null)
  const [cloneTitle, setCloneTitle] = useState('')

  const allCategories = [...new Set(templates.map((t) => t.category))].sort()
  const allTags = [...new Set(templates.flatMap((t) => t.tags ?? []))].sort()

  const filtered = templates.filter((t) => {
    if (!showDrafts && t.is_draft) return false
    if (filterCategory && t.category !== filterCategory) return false
    if (filterDept && resolveJoin(t.department)?.id !== filterDept) return false
    if (filterTag && !(t.tags ?? []).includes(filterTag)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      )
    }
    return true
  })

  const categories = [...new Set(filtered.map((t) => t.category))].sort()
  const draftCount = templates.filter((t) => t.is_draft).length
  const publishedCount = templates.filter((t) => !t.is_draft).length

  function handleClone() {
    if (!cloneTarget || !cloneTitle.trim()) return
    startTransition(async () => {
      const r = await cloneTemplate(cloneTarget.id, cloneTitle.trim())
      if (r.success) {
        toast.success('Template cloned as draft')
        setCloneTarget(null)
        setCloneTitle('')
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Clone failed')
      }
    })
  }

  function handlePublish(id: string, title: string) {
    startTransition(async () => {
      const r = await publishTemplate(id)
      if (r.success) {
        toast.success(`"${title}" published`)
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Publish failed')
      }
    })
  }

  function handleDeactivate(id: string, title: string) {
    if (!confirm(`Deactivate "${title}"? This cannot be undone unless re-enabled manually.`)) return
    startTransition(async () => {
      const r = await deleteTemplate(id)
      if (r.success) {
        toast.success('Template deactivated')
        window.location.reload()
      } else {
        toast.error(r.error ?? 'Deactivate failed')
      }
    })
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Competency Templates</h1>
          <p>
            {publishedCount} published
            {draftCount > 0 && `, ${draftCount} draft${draftCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="page-header-actions">
          {canEdit && (
            <Link href="/competencies/new" className="btn btn-primary btn-sm">＋ New Template</Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <span>🔍</span>
          <input
            placeholder="Search title, category, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {departments.length > 0 && (
          <select className="filter-select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select className="filter-select" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {canEdit && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showDrafts} onChange={(e) => setShowDrafts(e.target.checked)} />
            Show Drafts
          </label>
        )}
      </div>

      {categories.map((cat) => {
        const catTemplates = filtered.filter((t) => t.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {cat} <span style={{ fontWeight: 400, color: 'var(--gray-400)', textTransform: 'none' }}>({catTemplates.length})</span>
            </h3>
            <div className="grid-auto">
              {catTemplates.map((t) => (
                <div key={t.id} className="card" style={{ padding: 18, position: 'relative', opacity: t.is_draft ? 0.9 : 1 }}>
                  {/* Draft ribbon */}
                  {t.is_draft && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--amber, #f59e0b)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: '0 8px 0 8px', letterSpacing: '0.06em' }}>
                      DRAFT
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>{t.title}</h4>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        {t.subcategory && <span className="badge badge-gray">{t.subcategory}</span>}
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>v{t.version}</span>
                        {!!t.cloned_from_id && <span className="badge badge-gray" style={{ fontSize: 10 }}>cloned</span>}
                      </div>
                    </div>
                    <span className={`badge ${t.is_mandatory ? 'badge-red' : 'badge-gray'}`}>
                      {t.is_mandatory ? 'Mandatory' : 'Optional'}
                    </span>
                  </div>

                  {t.description && (
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10, lineHeight: 1.6 }}>
                      {t.description.slice(0, 100)}{t.description.length > 100 ? '…' : ''}
                    </p>
                  )}

                  {/* Scope badges */}
                  {(() => {
                    const dept = resolveJoin(t.department)
                    const unit = resolveJoin(t.unit)
                    return (dept || unit) ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {dept && <span className="badge badge-teal" style={{ fontSize: 10 }}>🏥 {dept.name}</span>}
                        {unit && <span className="badge badge-purple" style={{ fontSize: 10 }}>🔬 {unit.name}</span>}
                      </div>
                    ) : null
                  })()}

                  {/* Tags */}
                  {t.tags && t.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      {t.tags.slice(0, 4).map((tag) => (
                        <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)', cursor: 'pointer' }}
                          onClick={() => setFilterTag(tag === filterTag ? '' : tag)}>
                          #{tag}
                        </span>
                      ))}
                      {t.tags.length > 4 && <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>+{t.tags.length - 4}</span>}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {t.requires_knowledge && <span className="badge badge-blue">📖 Knowledge</span>}
                    {t.requires_quiz && <span className="badge badge-purple">📝 Quiz</span>}
                    {t.requires_practical && <span className="badge badge-teal">🤲 Practical</span>}
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Passing Score</span>
                    <span className="stat-value">{t.passing_score}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Valid For</span>
                    <span className="stat-value">{t.validity_months}m</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                    {!t.is_draft && (
                      <Link href={`/assessments/new?template=${t.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                        Start Assessment
                      </Link>
                    )}
                    {canPreview && (
                      <Link href={`/competencies/${t.id}/preview`} className="btn btn-secondary btn-sm">Preview</Link>
                    )}
                    {canEdit && (
                      <>
                        <Link href={`/competencies/${t.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setCloneTarget(t); setCloneTitle(`${t.title} (Copy)`) }}
                          disabled={isPending}
                        >
                          Clone
                        </button>
                        {t.is_draft && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handlePublish(t.id, t.title)}
                            disabled={isPending}
                          >
                            Publish
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivate(t.id, t.title)}
                          disabled={isPending}
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && templates.length === 0 && (
        <CompetencyZeroState canEdit={canEdit} />
      )}
      {filtered.length === 0 && templates.length > 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          No templates match your current filters.{' '}
          <button style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterDept(''); setFilterTag('') }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Clone modal */}
      {cloneTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Clone Template</h3>
              <button className="modal-close" onClick={() => setCloneTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
                Cloning <strong>{cloneTarget.title}</strong>. The copy will be saved as a draft.
              </p>
              <div className="form-group">
                <label className="form-label">New Title *</label>
                <input
                  className="form-control"
                  value={cloneTitle}
                  onChange={(e) => setCloneTitle(e.target.value)}
                  placeholder="Title for the cloned template"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloneTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleClone} disabled={isPending || !cloneTitle.trim()}>
                {isPending ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

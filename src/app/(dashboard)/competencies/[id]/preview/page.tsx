import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { TemplatePreviewClient } from './TemplatePreviewClient'

export const dynamic = 'force-dynamic'

export default async function TemplatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const [{ data: profile }, { data: template }] = await Promise.all([
    admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single(),
    admin.from(T.competency_templates)
      .select('id, title, category, subcategory, description, passing_score, validity_months, approval_levels, is_mandatory, is_draft, version, tags, requires_knowledge, requires_quiz, requires_practical, knowledge_sections, quiz_questions, practical_checklist')
      .eq('id', id)
      .single(),
  ])

  if (!template) notFound()

  const canEdit = ['hospital_admin', 'super_admin', 'educator', 'hr_quality'].includes(profile?.role ?? '')

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <Link href="/competencies" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>← Templates</Link>
          <h1 style={{ marginTop: 4 }}>{template.title}</h1>
          <p>
            {template.category}{template.subcategory ? ` / ${template.subcategory}` : ''}
            {' · '}v{template.version}
            {template.is_draft && ' · Draft'}
          </p>
        </div>
        <div className="page-header-actions">
          {canEdit && (
            <Link href={`/competencies/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
          )}
          {!template.is_draft && (
            <Link href={`/assessments/new?template=${id}`} className="btn btn-primary btn-sm">Start Assessment</Link>
          )}
        </div>
      </div>
      <TemplatePreviewClient template={template} />
    </>
  )
}

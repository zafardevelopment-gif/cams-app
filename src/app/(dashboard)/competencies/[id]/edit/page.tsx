import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import TemplateForm from '@/components/competencies/TemplateForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit Competency Template — CAMS' }

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  const [templateRes, historyRes, deptRes, unitRes] = await Promise.all([
    admin.from(T.competency_templates)
      .select(`
        id, title, category, subcategory, description,
        passing_score, validity_months, approval_levels,
        requires_knowledge, requires_quiz, requires_practical,
        is_mandatory, is_draft, version, tags,
        department_id, unit_id,
        knowledge_sections, quiz_questions, practical_checklist
      `)
      .eq('id', id)
      .single(),
    admin.from(T.template_history)
      .select(`id, field_name, old_value, new_value, version, changed_at, changer:${J.users}!changed_by(id, full_name)`)
      .eq('template_id', id)
      .order('changed_at', { ascending: false })
      .limit(100),
    admin.from(T.departments).select('id, name').eq('hospital_id', profile?.hospital_id ?? '').eq('is_active', true),
    admin.from(T.units).select('id, name').eq('hospital_id', profile?.hospital_id ?? '').eq('is_active', true),
  ])

  if (!templateRes.data) notFound()

  const t = templateRes.data

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Edit Template</h1>
          <p>{t.title} {t.is_draft ? '— Draft' : `— v${t.version}`}</p>
        </div>
      </div>
      <TemplateForm
        mode="edit"
        templateId={id}
        departments={deptRes.data ?? []}
        units={unitRes.data ?? []}
        history={historyRes.data ?? []}
        defaultValues={{
          title:               t.title,
          category:            t.category,
          subcategory:         t.subcategory ?? '',
          description:         t.description ?? '',
          passing_score:       t.passing_score,
          validity_months:     t.validity_months,
          approval_levels:     t.approval_levels,
          requires_knowledge:  t.requires_knowledge,
          requires_quiz:       t.requires_quiz,
          requires_practical:  t.requires_practical,
          is_mandatory:        t.is_mandatory,
          is_draft:            t.is_draft ?? false,
          tags:                t.tags ?? [],
          department_id:       t.department_id ?? '',
          unit_id:             t.unit_id ?? '',
          knowledge_sections:  t.knowledge_sections ?? [],
          quiz_questions:      t.quiz_questions ?? [],
          practical_checklist: t.practical_checklist ?? [],
        }}
      />
    </>
  )
}

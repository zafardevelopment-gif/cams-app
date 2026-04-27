import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { CompetenciesClient } from './CompetenciesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Competency Templates — CAMS' }

export default async function CompetenciesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  const { data: templates } = await admin
    .from(T.competency_templates)
    .select(`
      id, title, category, subcategory, description,
      passing_score, validity_months, approval_levels,
      is_mandatory, requires_knowledge, requires_quiz, requires_practical,
      is_draft, version, tags, cloned_from_id,
      department:${J.departments}!department_id(id, name),
      unit:${J.units}!unit_id(id, name)
    `)
    .eq('is_active', true)
    .order('category')
    .order('title')

  const { data: departments } = await admin
    .from(T.departments)
    .select('id, name')
    .eq('hospital_id', profile?.hospital_id ?? '')
    .eq('is_active', true)

  const canEdit = ['hospital_admin', 'super_admin', 'educator', 'hr_quality'].includes(profile?.role ?? '')

  return (
    <CompetenciesClient
      templates={templates ?? []}
      departments={departments ?? []}
      canEdit={canEdit}
    />
  )
}

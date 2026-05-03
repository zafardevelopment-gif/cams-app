import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { CompetenciesClient } from './CompetenciesClient'
import { getHospitalConfig } from '@/actions/hospitalConfig'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Competency Templates — CAMS' }

export default async function CompetenciesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  const hospitalId = profile?.hospital_id ?? ''
  const isSuperAdmin = profile?.role === 'super_admin'

  const isHospitalAdmin = !isSuperAdmin && profile?.role === 'hospital_admin' && !!hospitalId

  const templatesQuery = isSuperAdmin
    ? admin
        .from(T.competency_templates)
        .select(`
          id, title, category, subcategory, description,
          passing_score, validity_months, approval_levels,
          is_mandatory, requires_knowledge, requires_quiz, requires_practical,
          is_draft, version, tags, cloned_from_id, hospital_id,
          department:${J.departments}!department_id(id, name),
          unit:${J.units}!unit_id(id, name)
        `)
        .eq('is_active', true)
        .order('category')
        .order('title')
    : admin
        .from(T.competency_templates)
        .select(`
          id, title, category, subcategory, description,
          passing_score, validity_months, approval_levels,
          is_mandatory, requires_knowledge, requires_quiz, requires_practical,
          is_draft, version, tags, cloned_from_id, hospital_id,
          department:${J.departments}!department_id(id, name),
          unit:${J.units}!unit_id(id, name)
        `)
        .eq('is_active', true)
        .or(`hospital_id.eq.${hospitalId},hospital_id.is.null`)
        .order('category')
        .order('title')

  const [{ data: templates }, { data: departments }, branchesRes, hospitalConfig] = await Promise.all([
    templatesQuery,
    admin
      .from(T.departments)
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('is_active', true),
    admin
      .from(T.branches)
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('is_active', true),
    isHospitalAdmin ? getHospitalConfig(hospitalId) : Promise.resolve(null),
  ])

  const canEdit    = ['hospital_admin', 'super_admin', 'educator', 'hr_quality'].includes(profile?.role ?? '')
  const canPreview = ['hospital_admin', 'super_admin', 'educator', 'hr_quality', 'assessor', 'head_nurse', 'unit_head', 'department_head', 'branch_admin', 'auditor'].includes(profile?.role ?? '')

  const branchCount = branchesRes.count ?? 0
  if (isHospitalAdmin && hospitalConfig?.hasBranches === true && branchCount === 0) {
    redirect('/hospital/branches')
  }

  return (
    <CompetenciesClient
      templates={templates ?? []}
      departments={departments ?? []}
      canEdit={canEdit}
      canPreview={canPreview}
      currentHospitalId={isSuperAdmin ? null : hospitalId}
    />
  )
}

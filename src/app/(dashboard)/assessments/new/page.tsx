import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'
import { NewAssessmentForm } from './NewAssessmentForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New Assessment — CAMS' }

export default async function NewAssessmentPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: templateId } = await searchParams

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('hospital_id, role').eq('id', authUser!.id).single()

  const role = profile?.role ?? 'staff'
  const isStaff = ['staff', 'educator', 'auditor'].includes(role)

  const [{ data: templates }, { data: assessors }] = await Promise.all([
    admin.from(T.competency_templates).select('id, title, category').eq('is_active', true).order('category').order('title'),
    isStaff
      ? Promise.resolve({ data: [] })
      : admin.from(T.users).select('id, full_name').eq('hospital_id', profile?.hospital_id ?? '').eq('role', 'assessor').eq('status', 'active').order('full_name'),
  ])

  return (
    <NewAssessmentForm
      templates={(templates ?? []).map((t) => ({ id: t.id, title: t.title, category: t.category }))}
      assessors={(assessors ?? []).map((u) => ({ id: u.id, full_name: u.full_name }))}
      defaultTemplateId={templateId}
      isStaff={isStaff}
    />
  )
}

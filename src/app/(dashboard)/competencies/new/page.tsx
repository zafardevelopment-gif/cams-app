import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import TemplateForm from '@/components/competencies/TemplateForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New Competency Template — CAMS' }

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('hospital_id').eq('id', authUser!.id).single()

  const [deptRes, unitRes] = await Promise.all([
    admin.from(T.departments).select('id, name').eq('hospital_id', profile?.hospital_id ?? '').eq('is_active', true),
    admin.from(T.units).select('id, name').eq('hospital_id', profile?.hospital_id ?? '').eq('is_active', true),
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>New Competency Template</h1>
          <p>Define a new competency assessment template</p>
        </div>
      </div>
      <TemplateForm
        mode="create"
        departments={deptRes.data ?? []}
        units={unitRes.data ?? []}
      />
    </>
  )
}

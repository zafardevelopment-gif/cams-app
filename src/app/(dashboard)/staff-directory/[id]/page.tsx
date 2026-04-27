import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import { StaffProfileClient } from './StaffProfileClient'

export const dynamic = 'force-dynamic'

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser!.id)
    .single()

  const [{ data: staff }, { data: history }, { data: assessments }, { data: certs }, deptRes, branchRes] = await Promise.all([
    admin.from(T.users)
      .select(`*, department:${J.departments}!department_id(id, name), branch:${J.branches}!branch_id(id, name), unit:${J.units}!unit_id(id, name)`)
      .eq('id', id)
      .single(),
    admin.from(T.profile_history)
      .select('*')
      .eq('user_id', id)
      .order('changed_at', { ascending: false })
      .limit(50),
    admin.from(T.assessments)
      .select('id, status, created_at, template:CAMS_competency_templates!template_id(title)')
      .eq('staff_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from(T.certificates)
      .select('id, certificate_number, issued_date, expiry_date, status, template:CAMS_competency_templates!template_id(title)')
      .eq('staff_id', id)
      .order('issued_date', { ascending: false })
      .limit(10),
    admin.from(T.departments).select('id, name').eq('hospital_id', caller?.hospital_id ?? '').eq('is_active', true),
    admin.from(T.branches).select('id, name').eq('hospital_id', caller?.hospital_id ?? '').eq('is_active', true),
  ])

  if (!staff) notFound()

  // Hospital isolation — non-super-admins can only view their hospital's staff
  if (caller?.role !== 'super_admin' && staff.hospital_id !== caller?.hospital_id) notFound()

  const canManage = ['super_admin', 'hospital_admin', 'branch_admin', 'hr_quality'].includes(caller?.role ?? '')

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <Link href="/staff-directory" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>← Staff Directory</Link>
          <h1 style={{ marginTop: 4 }}>{staff.full_name}</h1>
          <p>{staff.job_title ?? staff.role}</p>
        </div>
      </div>
      <StaffProfileClient
        staff={staff}
        history={history ?? []}
        assessments={assessments ?? []}
        certs={certs ?? []}
        departments={deptRes.data ?? []}
        branches={branchRes.data ?? []}
        canManage={canManage}
      />
    </>
  )
}

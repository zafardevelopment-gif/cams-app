import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { AssessmentsClient } from './AssessmentsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Assessments — CAMS' }

export default async function AssessmentsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  let query = admin
    .from(T.assessments)
    .select(`id, status, overall_score, quiz_auto_score, attempt_number, reattempt_of, created_at, due_date, submitted_at,
      staff:${J.users}!staff_id(id, full_name, job_title),
      assessor:${J.users}!assessor_id(full_name),
      template:${J.competency_templates}!template_id(title, category, passing_score)`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (profile?.role === 'staff') {
    query = query.eq('staff_id', authUser!.id) as typeof query
  } else if (profile?.role === 'assessor') {
    query = query.eq('assessor_id', authUser!.id) as typeof query
  } else if (profile?.hospital_id) {
    query = query.eq('hospital_id', profile.hospital_id) as typeof query
  }

  const { data: assessments } = await query

  const callerRole = profile?.role ?? 'staff'
  const isStaff = callerRole === 'staff'

  return (
    <AssessmentsClient
      assessments={assessments ?? []}
      callerRole={callerRole}
      isStaff={isStaff}
      callerId={authUser!.id}
    />
  )
}

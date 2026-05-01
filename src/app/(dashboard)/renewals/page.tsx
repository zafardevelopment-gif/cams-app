import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import RenewalsClient from './RenewalsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Renewals — CAMS' }

export default async function RenewalsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single()

  let query = admin
    .from(T.renewals)
    .select(`id, status, due_date, template_id, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category), certificate:${J.certificates}!certificate_id(certificate_number)`)
    .not('status', 'eq', 'completed')
    .order('due_date')
    .limit(50)

  if (profile?.role === 'staff') {
    query = query.eq('staff_id', authUser!.id) as typeof query
  }

  const { data: renewals } = await query
  const list = renewals ?? []
  const today = new Date()

  const overdue = list.filter((r) => new Date(r.due_date) < today && r.status !== 'completed').length
  const due30 = list.filter((r) => {
    const d = new Date(r.due_date)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  }).length
  const upcoming = list.filter((r) => {
    const d = new Date(r.due_date)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 30 && diff <= 90
  }).length

  return (
    <RenewalsClient
      renewals={list as Parameters<typeof RenewalsClient>[0]['renewals']}
      overdue={overdue}
      due30={due30}
      upcoming={upcoming}
    />
  )
}

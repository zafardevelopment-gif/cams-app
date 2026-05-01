import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import { getHospitalConfig } from '@/actions/hospitalConfig'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — CAMS' }

// Roles that can edit the Approval Workflow
const WORKFLOW_EDITOR_ROLES = ['hospital_admin']

// Roles that belong to a hospital (show Hospital tab)
const HOSPITAL_ROLES = ['hospital_admin', 'branch_admin', 'department_head', 'unit_head', 'head_nurse', 'hr_quality', 'assessor', 'educator', 'staff', 'auditor']

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ data: profile }, { data: notifPrefs }, { data: emailCfgRows }] = await Promise.all([
    admin
      .from(T.users)
      .select(`full_name, email, phone, job_title, nursing_license, role, hospital_id, hospital:${J.hospitals}!hospital_id(name, city, contact_email)`)
      .eq('id', authUser!.id)
      .single(),
    admin.from('CAMS_notification_prefs').select('*').eq('user_id', authUser!.id).single(),
    admin.from(T.settings).select('key, value').in('key', ['resend_api_key', 'email_from']).is('hospital_id', null),
  ])

  const role = profile?.role ?? 'staff'
  const isSuperAdmin = role === 'super_admin'
  const canEditWorkflow = WORKFLOW_EDITOR_ROLES.includes(role)
  const hasHospital = HOSPITAL_ROLES.includes(role) && !!profile?.hospital_id

  const hospitalRaw = profile?.hospital as unknown
  const hospital = Array.isArray(hospitalRaw)
    ? (hospitalRaw[0] as { name: string; city: string; contact_email: string } | null)
    : (hospitalRaw as { name: string; city: string; contact_email: string } | null)

  // Load hospital config for hospital_admin (editable) or any hospital role (read-only)
  const hospitalConfig = hasHospital && profile?.hospital_id
    ? await getHospitalConfig(profile.hospital_id)
    : null

  const emailConfig = isSuperAdmin ? {
    resend_api_key: (emailCfgRows?.find((r) => r.key === 'resend_api_key')?.value as string) ?? '',
    email_from: (emailCfgRows?.find((r) => r.key === 'email_from')?.value as string) ?? '',
  } : null

  return (
    <SettingsClient
      profile={{
        full_name: profile?.full_name ?? '',
        email: profile?.email ?? authUser?.email ?? '',
        phone: profile?.phone ?? '',
        job_title: profile?.job_title ?? '',
        nursing_license: profile?.nursing_license ?? '',
      }}
      hospital={hospital ?? null}
      hasHospital={hasHospital}
      role={role}
      canEditWorkflow={canEditWorkflow}
      notifPrefs={notifPrefs ?? {}}
      hospitalConfig={hospitalConfig}
      emailConfig={emailConfig}
      adminEmail={authUser?.email ?? ''}
    />
  )
}

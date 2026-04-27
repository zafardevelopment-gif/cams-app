import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import type { UserRole } from '@/types'

interface ImportRow {
  full_name?: string
  email?: string
  password?: string
  role?: string
  job_title?: string
  phone?: string
  employee_id?: string
  nursing_license?: string
  license_expiry?: string
  hired_date?: string
  department_id?: string
  branch_id?: string
  unit_id?: string
}

const VALID_ROLES = ['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!caller || !['super_admin', 'hospital_admin', 'branch_admin', 'hr_quality'].includes(caller.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let rows: ImportRow[] = []
  try {
    const body = await request.json()
    rows = body.rows ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 })
  }

  const results: { row: number; email: string; status: 'created' | 'error'; error?: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = row.email?.trim()
    const fullName = row.full_name?.trim()
    const password = row.password?.trim() || 'ChangeMe@123'
    const role = (VALID_ROLES.includes(row.role ?? '') ? row.role : 'staff') as UserRole

    if (!email || !fullName) {
      results.push({ row: i + 1, email: email ?? '', status: 'error', error: 'full_name and email are required' })
      continue
    }

    try {
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName },
      })

      if (authErr) {
        results.push({ row: i + 1, email, status: 'error', error: authErr.message })
        continue
      }

      const { error: dbErr } = await admin.from(T.users).insert({
        id:              authData.user.id,
        full_name:       fullName,
        email,
        role,
        job_title:       row.job_title || null,
        phone:           row.phone || null,
        employee_id:     row.employee_id || null,
        nursing_license: row.nursing_license || null,
        license_expiry:  row.license_expiry || null,
        hired_date:      row.hired_date || null,
        hospital_id:     caller.hospital_id,
        department_id:   row.department_id || null,
        branch_id:       row.branch_id || null,
        unit_id:         row.unit_id || null,
        status:          'active',
        approved_by:     authUser.id,
        approved_at:     new Date().toISOString(),
      })

      if (dbErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ row: i + 1, email, status: 'error', error: dbErr.message })
        continue
      }

      results.push({ row: i + 1, email, status: 'created' })
    } catch (err) {
      results.push({ row: i + 1, email: email ?? '', status: 'error', error: String(err) })
    }
  }

  const created = results.filter((r) => r.status === 'created').length
  const failed  = results.filter((r) => r.status === 'error').length

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'bulk_import_users',
    entity_type: 'user',
    description: `Bulk import: ${created} created, ${failed} failed`,
    metadata: { total: rows.length, created, failed },
  })

  return NextResponse.json({ created, failed, results })
}

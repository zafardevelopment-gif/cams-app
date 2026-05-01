'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'

// ─── Super Admin ──────────────────────────────────────────────────────────────

export async function getSuperAdminDashboardData() {
  const admin = createAdminClient()

  const [
    { data: hospitals },
    { data: users },
    { data: assessments },
    { data: activityLogs },
  ] = await Promise.all([
    admin.from(T.hospitals).select('id, name, is_active, subscription_plan, subscription_expires_at, created_at'),
    admin.from(T.users).select('id, role, status, hospital_id, created_at'),
    admin.from(T.assessments).select('id, status, created_at'),
    admin.from(T.activity_logs).select('id, action, created_at, user_id').order('created_at', { ascending: false }).limit(10),
  ])

  const h = hospitals ?? []
  const u = users ?? []
  const a = assessments ?? []

  const totalHospitals = h.length
  const activeHospitals = h.filter((x) => x.is_active).length
  const totalUsers = u.length
  const activeUsers = u.filter((x) => x.status === 'active').length

  const now = new Date()
  const activeSubscriptions = h.filter((x) => {
    if (!x.subscription_expires_at) return x.is_active
    return new Date(x.subscription_expires_at) > now && x.is_active
  }).length

  // Monthly user registrations (last 6 months)
  const monthlyUsers = getMonthlyTrend(u, 6)
  // Monthly assessments (last 6 months)
  const monthlyAssessments = getMonthlyTrend(a, 6)

  return {
    totalHospitals,
    activeHospitals,
    totalUsers,
    activeUsers,
    activeSubscriptions,
    recentActivity: activityLogs ?? [],
    monthlyUsers,
    monthlyAssessments,
  }
}

// ─── Hospital Admin ───────────────────────────────────────────────────────────

export async function getHospitalAdminDashboardData(hospitalId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: pendingRegs },
    { data: assessments },
    { data: certs },
    { data: licenses },
    { data: transfers },
    { data: departments },
  ] = await Promise.all([
    admin.from(T.users).select('id, status, department_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.registration_requests).select('id, created_at').eq('hospital_id', hospitalId).eq('status', 'pending'),
    admin.from(T.assessments).select('id, status, department_id, branch_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.certificates).select('id, status, expiry_date').eq('hospital_id', hospitalId),
    admin.from(T.users).select('id, license_expiry').eq('hospital_id', hospitalId).not('license_expiry', 'is', null),
    admin.from(T.transfers).select('id, status, created_at').eq('to_hospital_id', hospitalId).eq('status', 'pending'),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
  ])

  const s = staff ?? []
  const a = assessments ?? []
  const c = certs ?? []
  const lic = licenses ?? []

  const totalStaff = s.filter((x) => x.status === 'active').length
  const pendingApprovals = (pendingRegs ?? []).length
  const activeAssessments = a.filter((x) => !['passed', 'failed'].includes(x.status)).length
  const passed = a.filter((x) => x.status === 'passed').length
  const failed = a.filter((x) => x.status === 'failed').length
  const passRate = a.length > 0 ? Math.round((passed / a.length) * 100) : 0

  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  const expiringLicenses = lic.filter((u) => u.license_expiry && new Date(u.license_expiry) <= soon).length

  const activeCerts = c.filter((x) => x.status === 'active').length
  const expiringCerts = c.filter((x) => x.status === 'expiring_soon').length
  const pendingTransfers = (transfers ?? []).length

  // Pass/fail trend (last 6 months)
  const passFailTrend = getPassFailTrend(a, 6)

  // Department compliance
  const deptList = departments ?? []
  const deptCompliance = deptList.map((d) => {
    const deptA = a.filter((x) => x.department_id === d.id)
    const deptPassed = deptA.filter((x) => x.status === 'passed').length
    const rate = deptA.length > 0 ? Math.round((deptPassed / deptA.length) * 100) : 0
    return { name: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name, compliance: rate, total: deptA.length }
  }).filter((d) => d.total > 0)

  return {
    totalStaff,
    pendingApprovals,
    activeAssessments,
    passRate,
    passed,
    failed,
    totalAssessments: a.length,
    expiringLicenses,
    activeCerts,
    expiringCerts,
    pendingTransfers,
    passFailTrend,
    deptCompliance,
  }
}

// ─── Branch Admin ─────────────────────────────────────────────────────────────

export async function getBranchAdminDashboardData(hospitalId: string, branchId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: assessments },
    { data: pendingRegs },
    { data: departments },
  ] = await Promise.all([
    admin.from(T.users).select('id, status, department_id').eq('hospital_id', hospitalId).eq('branch_id', branchId),
    admin.from(T.assessments).select('id, status, department_id, created_at').eq('hospital_id', hospitalId).eq('branch_id', branchId),
    admin.from(T.registration_requests).select('id').eq('hospital_id', hospitalId).eq('status', 'pending'),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('branch_id', branchId).eq('is_active', true),
  ])

  const s = staff ?? []
  const a = assessments ?? []

  const branchStaff = s.filter((x) => x.status === 'active').length
  const passed = a.filter((x) => x.status === 'passed').length
  const branchCompliance = a.length > 0 ? Math.round((passed / a.length) * 100) : 0
  const pendingActions = (pendingRegs ?? []).length
  const activeAssessments = a.filter((x) => !['passed', 'failed'].includes(x.status)).length

  // Department breakdown for branch
  const deptList = departments ?? []
  const deptBreakdown = deptList.map((d) => {
    const deptA = a.filter((x) => x.department_id === d.id)
    const deptPassed = deptA.filter((x) => x.status === 'passed').length
    const rate = deptA.length > 0 ? Math.round((deptPassed / deptA.length) * 100) : 0
    return { name: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name, compliance: rate }
  })

  const monthlyTrend = getPassFailTrend(a, 4)

  return {
    branchStaff,
    branchCompliance,
    pendingActions,
    activeAssessments,
    totalAssessments: a.length,
    deptBreakdown,
    monthlyTrend,
  }
}

// ─── Department Head ──────────────────────────────────────────────────────────

export async function getDeptHeadDashboardData(departmentId: string, userId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: assessments },
    { data: pendingApprovals },
    { data: overdueStaff },
  ] = await Promise.all([
    admin.from(T.users).select('id, full_name, status').eq('department_id', departmentId).eq('status', 'active'),
    admin.from(T.assessments).select('id, status, staff_id, created_at, due_date').eq('department_id', departmentId),
    admin.from(T.approvals).select('id').eq('approver_id', userId).eq('status', 'pending'),
    admin.from(T.assessments)
      .select('id, staff_id, due_date, status')
      .eq('department_id', departmentId)
      .not('due_date', 'is', null)
      .not('status', 'in', '("passed","failed")'),
  ])

  const a = assessments ?? []
  const passed = a.filter((x) => x.status === 'passed').length
  const failed = a.filter((x) => x.status === 'failed').length
  const pending = a.filter((x) => !['passed', 'failed'].includes(x.status)).length
  const passRate = a.length > 0 ? Math.round((passed / a.length) * 100) : 0

  const now = new Date()
  const overdue = (overdueStaff ?? []).filter((x) => x.due_date && new Date(x.due_date) < now)
  const overdueCount = overdue.length

  const trend = getPassFailTrend(a, 4)

  return {
    teamSize: (staff ?? []).length,
    pendingAssessments: pending,
    overdueCount,
    approvalsNeeded: (pendingApprovals ?? []).length,
    passed,
    failed,
    passRate,
    totalAssessments: a.length,
    trend,
  }
}

// ─── Unit Head ────────────────────────────────────────────────────────────────

export async function getUnitHeadDashboardData(unitId: string, userId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: assessments },
    { data: pendingApprovals },
  ] = await Promise.all([
    admin.from(T.users).select('id, status').eq('unit_id', unitId).eq('status', 'active'),
    admin.from(T.assessments).select('id, status, created_at').eq('unit_id', unitId),
    admin.from(T.approvals).select('id').eq('approver_id', userId).eq('status', 'pending'),
  ])

  const a = assessments ?? []
  const passed = a.filter((x) => x.status === 'passed').length
  const pending = a.filter((x) => !['passed', 'failed'].includes(x.status)).length
  const passRate = a.length > 0 ? Math.round((passed / a.length) * 100) : 0

  return {
    teamSize: (staff ?? []).length,
    pendingAssessments: pending,
    approvalsNeeded: (pendingApprovals ?? []).length,
    passRate,
    passed,
    failed: a.filter((x) => x.status === 'failed').length,
    totalAssessments: a.length,
    trend: getPassFailTrend(a, 4),
  }
}

// ─── Educator / HR Quality ────────────────────────────────────────────────────

export async function getEducatorDashboardData(hospitalId: string, userId: string) {
  const admin = createAdminClient()

  const [
    { data: templates },
    { data: allAssessments },
    { data: myAssignments },
    { data: staff },
  ] = await Promise.all([
    admin.from(T.competency_templates).select('id, title, category, is_active').eq('hospital_id', hospitalId),
    admin.from(T.assessments).select('id, status, staff_id, department_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.assessments).select('id, status').eq('assessor_id', userId).not('status', 'in', '("passed","failed")'),
    admin.from(T.users).select('id, status, department_id').eq('hospital_id', hospitalId).eq('status', 'active'),
  ])

  const t = templates ?? []
  const a = allAssessments ?? []
  const s = staff ?? []

  const activeTemplates = t.filter((x) => x.is_active).length
  const totalStaff = s.length
  const passed = a.filter((x) => x.status === 'passed').length
  const completionRate = a.length > 0 ? Math.round((passed / a.length) * 100) : 0

  // Failed staff (unique staff_ids with failed status)
  const failedStaffIds = [...new Set(a.filter((x) => x.status === 'failed').map((x) => x.staff_id))]

  // Category breakdown
  const categoryBreakdown = t.reduce<Record<string, number>>((acc, tmpl) => {
    const cat = tmpl.category ?? 'Uncategorized'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {})

  const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value }))

  return {
    activeTemplates,
    totalTemplates: t.length,
    completionRate,
    failedStaffCount: failedStaffIds.length,
    totalStaff,
    pendingEvals: (myAssignments ?? []).length,
    categoryData,
    trend: getPassFailTrend(a, 6),
  }
}

export async function getHrQualityDashboardData(hospitalId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: certs },
    { data: assessments },
    { data: renewals },
    { data: transfers },
    { data: departments },
  ] = await Promise.all([
    admin.from(T.users).select('id, status, department_id').eq('hospital_id', hospitalId),
    admin.from(T.certificates).select('id, status, expiry_date, staff_id').eq('hospital_id', hospitalId),
    admin.from(T.assessments).select('id, status, department_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.renewals).select('id, status').eq('status', 'overdue'),
    admin.from(T.transfers).select('id, status').eq('to_hospital_id', hospitalId).eq('status', 'pending'),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
  ])

  const s = staff ?? []
  const c = certs ?? []
  const a = assessments ?? []

  const activeStaff = s.filter((x) => x.status === 'active').length
  const activeCerts = c.filter((x) => x.status === 'active').length
  const expiringCerts = c.filter((x) => x.status === 'expiring_soon').length
  const passed = a.filter((x) => x.status === 'passed').length
  const complianceRate = a.length > 0 ? Math.round((passed / a.length) * 100) : 0

  // Dept compliance
  const deptList = departments ?? []
  const deptCompliance = deptList.map((d) => {
    const deptA = a.filter((x) => x.department_id === d.id)
    const dp = deptA.filter((x) => x.status === 'passed').length
    const rate = deptA.length > 0 ? Math.round((dp / deptA.length) * 100) : 0
    return { name: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name, compliance: rate, total: deptA.length }
  }).filter((d) => d.total > 0)

  return {
    activeStaff,
    activeCerts,
    expiringCerts,
    complianceRate,
    overdueRenewals: (renewals ?? []).length,
    pendingTransfers: (transfers ?? []).length,
    deptCompliance,
    trend: getPassFailTrend(a, 6),
  }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaffDashboardData(userId: string) {
  const admin = createAdminClient()

  const [{ data: assessments }, { data: certs }, { data: renewals }] = await Promise.all([
    admin.from(T.assessments)
      .select(`id, status, overall_score, created_at, due_date, template:${J.competency_templates}!template_id(title, category)`)
      .eq('staff_id', userId)
      .order('created_at', { ascending: false }),
    admin.from(T.certificates)
      .select(`id, status, expiry_date, issued_date, template:${J.competency_templates}!template_id(title)`)
      .eq('staff_id', userId)
      .order('expiry_date'),
    admin.from(T.renewals)
      .select('id, status, due_date')
      .eq('staff_id', userId)
      .in('status', ['due', 'overdue']),
  ])

  const a = assessments ?? []
  const c = certs ?? []

  const passed = a.filter((x) => x.status === 'passed').length
  const activeCerts = c.filter((x) => x.status === 'active').length
  const expiringCerts = c.filter((x) => x.status === 'expiring_soon').length

  const now = new Date()
  const dueItems = a.filter((x) => x.due_date && new Date(x.due_date) <= new Date(now.getTime() + 7 * 86400000) && !['passed', 'failed'].includes(x.status))

  return {
    assessments: a,
    certificates: c,
    passed,
    activeCerts,
    expiringCerts,
    dueItems,
    dueRenewals: (renewals ?? []).length,
    complianceRate: a.length > 0 ? Math.round((passed / a.length) * 100) : 0,
  }
}

// ─── Auditor ──────────────────────────────────────────────────────────────────

export async function getAuditorDashboardData(hospitalId: string) {
  const admin = createAdminClient()

  const [
    { data: staff },
    { data: certs },
    { data: assessments },
    { data: expiredCerts },
    { data: branches },
    { data: departments },
  ] = await Promise.all([
    admin.from(T.users).select('id, status').eq('hospital_id', hospitalId).eq('status', 'active'),
    admin.from(T.certificates).select('id, status, expiry_date').eq('hospital_id', hospitalId),
    admin.from(T.assessments).select('id, status, branch_id, department_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.certificates).select('id').eq('hospital_id', hospitalId).eq('status', 'expired'),
    admin.from(T.branches).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
  ])

  const a = assessments ?? []
  const c = certs ?? []

  const totalStaff = (staff ?? []).length
  const passed = a.filter((x) => x.status === 'passed').length
  const failed = a.filter((x) => x.status === 'failed').length
  const totalCompleted = passed + failed
  const complianceRate = totalCompleted > 0 ? Math.round((passed / totalCompleted) * 100) : 0
  const activeCerts = c.filter((x) => x.status === 'active').length
  const expiringSoon = c.filter((x) => x.status === 'expiring_soon').length
  const expiredCount = (expiredCerts ?? []).length

  // Branch compliance breakdown
  const branchList = branches ?? []
  const branchCompliance = branchList.map((b) => {
    const ba = a.filter((x) => x.branch_id === b.id)
    const bp = ba.filter((x) => x.status === 'passed').length
    const bf = ba.filter((x) => x.status === 'failed').length
    const total = bp + bf
    return { name: b.name.length > 14 ? b.name.slice(0, 14) + '…' : b.name, compliance: total > 0 ? Math.round((bp / total) * 100) : 0, total }
  }).filter((b) => b.total > 0)

  // Department compliance breakdown
  const deptList = departments ?? []
  const deptCompliance = deptList.map((d) => {
    const da = a.filter((x) => x.department_id === d.id)
    const dp = da.filter((x) => x.status === 'passed').length
    const df = da.filter((x) => x.status === 'failed').length
    const total = dp + df
    return { name: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name, compliance: total > 0 ? Math.round((dp / total) * 100) : 0, total }
  }).filter((d) => d.total > 0)

  return {
    totalStaff,
    complianceRate,
    activeCerts,
    expiringSoon,
    expiredCount,
    totalAssessments: a.length,
    passed,
    failed,
    branchCompliance,
    deptCompliance,
    trend: getPassFailTrend(a, 6),
  }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ReportFilters {
  hospitalId?: string
  branchId?: string
  departmentId?: string
  role?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export async function getStaffCompetencyMatrix(filters: ReportFilters) {
  const admin = createAdminClient()

  let q = admin.from(T.assessments)
    .select(`
      id, status, overall_score, created_at, completed_at,
      staff:${J.users}!staff_id(id, full_name, job_title, department_id, branch_id),
      template:${J.competency_templates}!template_id(id, title, category, passing_score),
      certificate:${J.certificates}!assessment_id(id, status, expiry_date)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (filters.hospitalId) q = q.eq('hospital_id', filters.hospitalId)
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59')

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

export async function getPassFailReport(filters: ReportFilters) {
  const admin = createAdminClient()

  let q = admin.from(T.assessments)
    .select(`
      id, status, overall_score, knowledge_score, quiz_score, practical_score, created_at, completed_at,
      staff:${J.users}!staff_id(full_name, job_title, employee_id),
      template:${J.competency_templates}!template_id(title, category, passing_score)
    `)
    .in('status', ['passed', 'failed'])
    .order('completed_at', { ascending: false })
    .limit(500)

  if (filters.hospitalId) q = q.eq('hospital_id', filters.hospitalId)
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59')

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

export async function getOverdueAssessments(filters: ReportFilters) {
  const admin = createAdminClient()

  const now = new Date().toISOString()
  let q = admin.from(T.assessments)
    .select(`
      id, status, due_date, created_at,
      staff:${J.users}!staff_id(full_name, job_title, department_id),
      template:${J.competency_templates}!template_id(title, category)
    `)
    .not('due_date', 'is', null)
    .lt('due_date', now)
    .not('status', 'in', '("passed","failed")')
    .order('due_date')
    .limit(500)

  if (filters.hospitalId) q = q.eq('hospital_id', filters.hospitalId)
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId)

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

export async function getCertificateExpiryReport(filters: ReportFilters) {
  const admin = createAdminClient()

  let q = admin.from(T.certificates)
    .select(`
      id, certificate_number, status, issued_date, expiry_date, overall_score,
      staff:${J.users}!staff_id(full_name, job_title, employee_id),
      template:${J.competency_templates}!template_id(title, category)
    `)
    .order('expiry_date')
    .limit(500)

  if (filters.hospitalId) q = q.eq('hospital_id', filters.hospitalId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.dateFrom) q = q.gte('expiry_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('expiry_date', filters.dateTo)

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

export async function getTransferHistoryReport(filters: ReportFilters) {
  const admin = createAdminClient()

  let q = admin.from(T.transfers)
    .select(`
      id, status, reason, effective_date, created_at,
      staff:${J.users}!staff_id(full_name, job_title, employee_id),
      from_hospital:${J.hospitals}!from_hospital_id(name),
      to_hospital:${J.hospitals}!to_hospital_id(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (filters.hospitalId) q = q.or(`from_hospital_id.eq.${filters.hospitalId},to_hospital_id.eq.${filters.hospitalId}`)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59')

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

export async function getTemplateUsageReport(filters: ReportFilters) {
  const admin = createAdminClient()

  let q = admin.from(T.competency_templates)
    .select(`
      id, title, category, is_active, is_mandatory, validity_months, passing_score, created_at,
      assessments:${J.assessments}!template_id(id, status)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters.hospitalId) q = q.eq('hospital_id', filters.hospitalId)

  const { data, error } = await q
  if (error) return { success: false as const, error: error.message }

  const mapped = (data ?? []).map((t) => {
    const raw = t.assessments as unknown
    const assessments = (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as { id: string; status: string }[]
    const total = assessments.length
    const passed = assessments.filter((a) => a.status === 'passed').length
    const failed = assessments.filter((a) => a.status === 'failed').length
    return { ...t, totalUsage: total, passed, failed, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 }
  })

  return { success: true as const, data: mapped }
}

export async function getBranchComparisonReport(hospitalId: string) {
  const admin = createAdminClient()

  const [{ data: branches }, { data: assessments }, { data: staff }] = await Promise.all([
    admin.from(T.branches).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
    admin.from(T.assessments).select('id, status, branch_id').eq('hospital_id', hospitalId),
    admin.from(T.users).select('id, status, branch_id').eq('hospital_id', hospitalId).eq('status', 'active'),
  ])

  const data = (branches ?? []).map((b) => {
    const ba = (assessments ?? []).filter((a) => a.branch_id === b.id)
    const bs = (staff ?? []).filter((s) => s.branch_id === b.id)
    const passed = ba.filter((a) => a.status === 'passed').length
    const compliance = ba.length > 0 ? Math.round((passed / ba.length) * 100) : 0
    return {
      branch: b.name,
      staff: bs.length,
      assessments: ba.length,
      passed,
      failed: ba.filter((a) => a.status === 'failed').length,
      compliance,
    }
  })

  return { success: true as const, data }
}

export async function getDepartmentPerformanceReport(hospitalId: string, filters: ReportFilters = {}) {
  const admin = createAdminClient()

  const [{ data: departments }, { data: assessments }, { data: staff }] = await Promise.all([
    admin.from(T.departments).select('id, name').eq('hospital_id', hospitalId).eq('is_active', true),
    admin.from(T.assessments).select('id, status, department_id, created_at').eq('hospital_id', hospitalId),
    admin.from(T.users).select('id, status, department_id').eq('hospital_id', hospitalId).eq('status', 'active'),
  ])

  let a = assessments ?? []
  if (filters.dateFrom) a = a.filter((x) => x.created_at >= filters.dateFrom!)
  if (filters.dateTo) a = a.filter((x) => x.created_at <= filters.dateTo! + 'T23:59:59')

  const data = (departments ?? []).map((d) => {
    const da = a.filter((x) => x.department_id === d.id)
    const ds = (staff ?? []).filter((s) => s.department_id === d.id)
    const passed = da.filter((x) => x.status === 'passed').length
    const failed = da.filter((x) => x.status === 'failed').length
    const compliance = da.length > 0 ? Math.round((passed / da.length) * 100) : 0
    return {
      department: d.name,
      staff: ds.length,
      assessments: da.length,
      passed,
      failed,
      compliance,
    }
  }).filter((d) => d.assessments > 0)

  return { success: true as const, data }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyTrend(rows: { created_at: string }[], months: number) {
  const result: { month: string; count: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const y = d.getFullYear()
    const m = d.getMonth()
    const count = rows.filter((r) => {
      const rd = new Date(r.created_at)
      return rd.getFullYear() === y && rd.getMonth() === m
    }).length
    result.push({ month: label, count })
  }
  return result
}

function getPassFailTrend(rows: { created_at: string; status: string }[], months: number) {
  const result: { month: string; passed: number; failed: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const y = d.getFullYear()
    const m = d.getMonth()
    const monthRows = rows.filter((r) => {
      const rd = new Date(r.created_at)
      return rd.getFullYear() === y && rd.getMonth() === m
    })
    result.push({
      month: label,
      passed: monthRows.filter((r) => r.status === 'passed').length,
      failed: monthRows.filter((r) => r.status === 'failed').length,
    })
  }
  return result
}

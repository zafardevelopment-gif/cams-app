export type UserRole =
  | 'super_admin'
  | 'hospital_admin'
  | 'branch_admin'
  | 'department_head'
  | 'unit_head'
  | 'head_nurse'
  | 'educator'
  | 'hr_quality'
  | 'assessor'
  | 'staff'
  | 'auditor'
export type UserStatus = 'pending' | 'active' | 'inactive' | 'suspended'
export type AssessmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'assessor_review'
  | 'head_nurse_review'
  | 'admin_review'
  | 'passed'
  | 'failed'
  | 'needs_renewal'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped'
export type CertStatus = 'active' | 'expiring_soon' | 'expired' | 'revoked'
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed'
export type RenewalStatus = 'upcoming' | 'due' | 'overdue' | 'in_progress' | 'completed'
export type NotifType = 'info' | 'warning' | 'success' | 'danger'

// ── RBAC ─────────────────────────────────────────────────────────────────────

export type RbacModule = 'staff' | 'departments' | 'units' | 'competencies' | 'assessments' | 'reports' | 'billing' | 'settings'
export type RbacAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'assign'
export type RbacScope  = 'hospital' | 'branch' | 'department' | 'unit'

export interface RoleDefinition {
  id:           string
  hospital_id:  string | null
  role_key:     string
  display_name: string
  description:  string | null
  is_system:    boolean
  is_active:    boolean
  created_at:   string
  updated_at:   string
  permissions?: RolePermission[]
}

export interface RolePermission {
  id:                 string
  role_definition_id: string
  module:             RbacModule
  action:             RbacAction
  scope:              RbacScope
  granted:            boolean
  created_at:         string
}

/** Flat map used in the UI: `${module}.${action}` → true/false */
export type PermissionMap = Partial<Record<`${RbacModule}.${RbacAction}`, boolean>>

export interface Hospital {
  id: string
  name: string
  name_ar?: string
  city?: string
  region?: string
  license_number?: string
  cbahi_accredited: boolean
  logo_url?: string
  primary_color: string
  contact_email?: string
  contact_phone?: string
  is_active: boolean
  subscription_plan: string
  subscription_expires_at?: string
  max_users: number
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  hospital_id: string
  name: string
  name_ar?: string
  city?: string
  address?: string
  contact_email?: string
  contact_phone?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  hospital_id: string
  branch_id?: string
  name: string
  name_ar?: string
  code?: string
  parent_id?: string
  head_nurse_id?: string
  is_active: boolean
  created_at: string
  branch?: Branch
}

export interface Unit {
  id: string
  department_id: string
  hospital_id: string
  branch_id?: string
  name: string
  name_ar?: string
  head_user_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
  department?: Department
  branch?: Branch
  head_user?: User
}

export interface User {
  id: string
  hospital_id?: string
  department_id?: string
  branch_id?: string
  unit_id?: string
  employee_id?: string
  full_name: string
  full_name_ar?: string
  email: string
  phone?: string
  role: UserRole
  status: UserStatus
  job_title?: string
  specialization?: string
  nursing_license?: string
  license_expiry?: string
  hired_date?: string
  profile_photo_url?: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  last_login_at?: string
  archived_at?: string
  archived_by?: string
  termination_reason?: string
  created_at: string
  updated_at: string
  hospital?: Hospital
  branch?: Branch
  department?: Department
  unit?: Unit
}

export interface ProfileHistory {
  id: string
  user_id: string
  changed_by?: string
  field_name: string
  old_value?: string
  new_value?: string
  changed_at: string
  changer?: Pick<User, 'id' | 'full_name'>
}

export interface RegistrationRequest {
  id: string
  hospital_id?: string
  branch_id?: string
  unit_id?: string
  department_id?: string
  full_name: string
  email: string
  phone?: string
  job_title?: string
  employee_id?: string
  nursing_license?: string
  role: UserRole
  status: ApprovalStatus
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  supabase_user_id?: string
  created_at: string
}

export interface CompetencyTemplate {
  id: string
  hospital_id?: string
  department_id?: string
  unit_id?: string
  title: string
  title_ar?: string
  category: string
  subcategory?: string
  description?: string
  passing_score: number
  validity_months: number
  requires_practical: boolean
  requires_knowledge: boolean
  requires_quiz: boolean
  knowledge_sections: KnowledgeSection[]
  quiz_questions: QuizQuestion[]
  practical_checklist: PracticalItem[]
  approval_levels: number
  is_mandatory: boolean
  is_active: boolean
  is_draft: boolean
  version: number
  tags: string[]
  parent_id?: string
  cloned_from_id?: string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
  department?: Pick<Department, 'id' | 'name'>
  unit?: Pick<Unit, 'id' | 'name'>
}

export interface TemplateHistory {
  id: string
  template_id?: string
  changed_by?: string
  version: number
  field_name: string
  old_value?: string
  new_value?: string
  changed_at: string
  changer?: Pick<User, 'id' | 'full_name'> | Pick<User, 'id' | 'full_name'>[]
}

export interface KnowledgeSection {
  id: string
  title: string
  content: string
  order: number
}

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'rating' | 'checklist'

export interface QuizQuestion {
  id: string
  question: string
  type: QuestionType
  options: string[]
  correct_index: number
  correct_answer?: string
  explanation?: string
  required?: boolean
  max_score?: number
}

export interface PracticalItem {
  id: string
  item: string
  category?: string
  is_critical: boolean
  order: number
}

export interface Assessment {
  id: string
  template_id: string
  staff_id: string
  assessor_id?: string
  hospital_id?: string
  department_id?: string
  branch_id?: string
  unit_id?: string
  status: AssessmentStatus
  knowledge_score?: number
  quiz_score?: number
  practical_score?: number
  overall_score?: number
  quiz_auto_score?: number
  knowledge_responses: Record<string, unknown>
  knowledge_responses_v2?: Record<string, unknown>
  quiz_responses: Record<string, unknown>
  practical_results: Record<string, unknown>
  practical_scores?: Record<string, { done: boolean; score?: number }>
  autosave_data?: Record<string, unknown>
  autosaved_at?: string
  assessor_notes?: string
  evaluator_notes?: string
  evidence_urls?: string[]
  reattempt_of?: string
  started_at?: string
  submitted_at?: string
  completed_at?: string
  due_date?: string
  attempt_number: number
  previous_assessment_id?: string
  created_at: string
  updated_at: string
  template?: CompetencyTemplate
  staff?: User
  assessor?: User
  approvals?: Approval[]
  evidence?: AssessmentEvidence[]
}

export interface AssessmentEvidence {
  id: string
  assessment_id: string
  uploaded_by?: string
  file_url: string
  file_name: string
  file_size?: number
  mime_type?: string
  label?: string
  uploaded_at: string
  uploader?: Pick<User, 'id' | 'full_name'>
}

export interface Approval {
  id: string
  assessment_id: string
  approver_id: string
  approver_role: UserRole
  level: number
  status: ApprovalStatus
  comments?: string
  signature_data?: string
  approved_at?: string
  created_at: string
  approver?: User
}

export interface Certificate {
  id: string
  certificate_number: string
  assessment_id: string
  staff_id: string
  template_id: string
  hospital_id?: string
  issued_date: string
  expiry_date: string
  status: CertStatus
  overall_score?: number
  qr_code_data?: string
  pdf_url?: string
  issued_by?: string
  revoked_at?: string
  revoked_by?: string
  revocation_reason?: string
  created_at: string
  staff?: User
  template?: CompetencyTemplate
  assessment?: Assessment
}

export interface Renewal {
  id: string
  certificate_id: string
  staff_id: string
  template_id: string
  status: RenewalStatus
  due_date: string
  notified_90d: boolean
  notified_60d: boolean
  notified_30d: boolean
  notified_7d: boolean
  new_assessment_id?: string
  completed_at?: string
  created_at: string
  updated_at: string
  certificate?: Certificate
  template?: CompetencyTemplate
  staff?: User
}

export interface Transfer {
  id: string
  staff_id: string
  from_hospital_id?: string
  from_department_id?: string
  to_hospital_id?: string
  to_department_id?: string
  reason?: string
  status: TransferStatus
  requested_by?: string
  head_nurse_approval: ApprovalStatus
  head_nurse_id?: string
  head_nurse_approved_at?: string
  admin_approval: ApprovalStatus
  admin_id?: string
  admin_approved_at?: string
  effective_date?: string
  notes?: string
  created_at: string
  updated_at: string
  staff?: User
  from_hospital?: Hospital
  to_hospital?: Hospital
}

export interface Notification {
  id: string
  user_id: string
  type: NotifType
  category?: string
  title: string
  body: string
  action_url?: string
  is_read: boolean
  email_sent: boolean
  reference_id?: string
  reference_type?: string
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id?: string
  action: string
  entity_type?: string
  entity_id?: string
  description?: string
  metadata: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
  user?: User
}

export interface Setting {
  id: string
  hospital_id?: string
  key: string
  value: unknown
  updated_by?: string
  updated_at: string
}

export interface DashboardStats {
  totalStaff: number
  activeAssessments: number
  pendingApprovals: number
  issuedCertificates: number
  expiringCertificates: number
  complianceRate: number
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'read_only'
export type BillingCycle = 'monthly' | 'yearly'
export type InvoiceStatus = 'pending' | 'paid' | 'void' | 'refunded'
export type DiscountType = 'percent' | 'fixed'
export type SignupStatus = 'pending' | 'approved' | 'rejected'

export interface Plan {
  id: string
  name: string
  name_ar?: string
  price_monthly: number
  price_yearly: number
  max_users: number
  max_branches: number
  max_departments: number
  features: string[]
  is_active: boolean
  sort_order: number
  duration_days: number
  trial_days: number
  description?: string
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  description?: string
  discount_type: DiscountType
  discount_value: number
  applies_to_plan?: string
  max_uses?: number
  used_count: number
  valid_from: string
  valid_until?: string
  is_active: boolean
  created_by?: string
  created_at: string
}

export interface Subscription {
  id: string
  hospital_id: string
  plan_id: string
  status: SubscriptionStatus
  billing_cycle: BillingCycle
  price_override?: number
  coupon_id?: string
  trial_ends_at?: string
  current_period_start: string
  current_period_end?: string
  cancelled_at?: string
  cancel_reason?: string
  gateway: string
  gateway_customer_id?: string
  gateway_sub_id?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  hospital?: Hospital
  plan?: Plan
  coupon?: Coupon
}

export interface Invoice {
  id: string
  invoice_number: string
  hospital_id: string
  subscription_id?: string
  plan_id?: string
  amount: number
  tax: number
  total: number
  currency: string
  status: InvoiceStatus
  payment_method?: string
  payment_ref?: string
  paid_at?: string
  period_start?: string
  period_end?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  hospital?: Hospital
  plan?: Plan
}

export interface HospitalSignup {
  id: string
  hospital_name: string
  hospital_name_ar?: string
  city?: string
  region?: string
  license_number?: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  plan_id: string
  coupon_code?: string
  message?: string
  status: SignupStatus
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  hospital_id?: string
  created_at: string
  plan?: Plan
}

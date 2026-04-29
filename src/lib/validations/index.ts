import { z } from 'zod'

// ── Auth ────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
})

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  full_name: z.string().min(2, 'Full name is required').max(120).trim(),
  hospital_id: z.string().uuid().optional().or(z.literal('')),
  department_id: z.string().uuid().optional().or(z.literal('')),
  job_title: z.string().max(100).trim().optional().or(z.literal('')),
  phone: z.string().max(30).trim().optional().or(z.literal('')),
  employee_id: z.string().max(50).trim().optional().or(z.literal('')),
  nursing_license: z.string().max(80).trim().optional().or(z.literal('')),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
})

export const UpdatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

// ── Assessments ─────────────────────────────────────────────
export const CreateAssessmentSchema = z.object({
  template_id: z.string().uuid('Invalid template'),
  staff_id: z.string().uuid().optional().or(z.literal('')),
  assessor_id: z.string().uuid().optional().or(z.literal('')),
  due_date: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
})

export const SubmitAssessmentSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  knowledge_score: z.number().min(0).max(100).optional(),
  quiz_score: z.number().min(0).max(100).optional(),
  practical_score: z.number().min(0).max(100).optional(),
  assessor_notes: z.string().max(2000).trim().optional(),
})

export const ProcessApprovalSchema = z.object({
  approvalId: z.string().uuid('Invalid approval ID'),
  action: z.enum(['approved', 'rejected']),
  comments: z.string().max(2000).trim().optional(),
})

// ── Competency Templates ────────────────────────────────────
const booleanField = z
  .union([z.enum(['true', 'false']), z.boolean()])
  .transform((v) => v === true || v === 'true')
  .optional()
  .default(true)

export const TemplateSchema = z.object({
  title: z.string().min(2, 'Title is required').max(200).trim(),
  category: z.string().min(1, 'Category is required').max(100).trim(),
  subcategory: z.string().max(100).trim().optional().or(z.literal('')),
  description: z.string().max(2000).trim().optional().or(z.literal('')),
  passing_score: z.coerce.number().int().min(1).max(100).default(80),
  validity_months: z.coerce.number().int().min(1).max(120).default(12),
  approval_levels: z.coerce.number().int().min(1).max(5).default(3),
  requires_knowledge: booleanField,
  requires_quiz: booleanField,
  requires_practical: booleanField,
  is_mandatory: booleanField,
})

// ── Users ───────────────────────────────────────────────────
export const ApproveRegistrationSchema = z.object({
  registrationId: z.string().uuid('Invalid registration ID'),
})

export const RejectRegistrationSchema = z.object({
  registrationId: z.string().uuid('Invalid registration ID'),
  reason: z.string().min(5, 'Please provide a reason').max(500).trim(),
})

export const UpdateUserStatusSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  status: z.enum(['active', 'suspended', 'inactive']),
})

// ── Settings ────────────────────────────────────────────────
export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2, 'Name is required').max(120).trim(),
  phone: z.string().max(30).trim().optional().or(z.literal('')),
  job_title: z.string().max(100).trim().optional().or(z.literal('')),
  nursing_license: z.string().max(80).trim().optional().or(z.literal('')),
})

export const ChangePasswordSchema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

// ── User Management ─────────────────────────────────────────
export const CreateUserSchema = z.object({
  full_name:       z.string().min(2, 'Full name is required').max(120).trim(),
  email:           z.string().email('Invalid email').max(254),
  password:        z.string().min(8, 'Password must be at least 8 characters').max(128),
  role:            z.enum(['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor']),
  job_title:       z.string().max(100).trim().optional().or(z.literal('')),
  phone:           z.string().max(30).trim().optional().or(z.literal('')),
  employee_id:     z.string().max(50).trim().optional().or(z.literal('')),
  nursing_license: z.string().max(80).trim().optional().or(z.literal('')),
  license_expiry:  z.string().optional().or(z.literal('')).refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  hired_date:      z.string().optional().or(z.literal('')).refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  department_id:   z.string().uuid().optional().or(z.literal('')),
  branch_id:       z.string().uuid().optional().or(z.literal('')),
  unit_id:         z.string().uuid().optional().or(z.literal('')),
})

export const EditUserSchema = z.object({
  full_name:       z.string().min(2, 'Full name is required').max(120).trim(),
  job_title:       z.string().max(100).trim().optional().or(z.literal('')),
  phone:           z.string().max(30).trim().optional().or(z.literal('')),
  employee_id:     z.string().max(50).trim().optional().or(z.literal('')),
  nursing_license: z.string().max(80).trim().optional().or(z.literal('')),
  license_expiry:  z.string().optional().or(z.literal('')).refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  hired_date:      z.string().optional().or(z.literal('')).refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  role:            z.enum(['staff','assessor','educator','head_nurse','unit_head','department_head','hr_quality','branch_admin','hospital_admin','auditor']),
  department_id:   z.string().uuid().optional().or(z.literal('')),
  branch_id:       z.string().uuid().optional().or(z.literal('')),
  unit_id:         z.string().uuid().optional().or(z.literal('')),
})

export const ArchiveUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().min(5, 'Please provide a reason').max(500).trim(),
})

export const RequestTransferSchema = z.object({
  staff_id:         z.string().uuid('Invalid staff ID'),
  to_department_id: z.string().uuid().optional().or(z.literal('')),
  to_branch_id:     z.string().uuid().optional().or(z.literal('')),
  to_hospital_id:   z.string().uuid().optional().or(z.literal('')),
  reason:           z.string().min(5, 'Please provide a reason').max(500).trim(),
  effective_date:   z.string().optional().or(z.literal('')),
})

export const ProcessTransferSchema = z.object({
  transferId: z.string().uuid('Invalid transfer ID'),
  action:     z.enum(['approved', 'rejected']),
  notes:      z.string().max(500).trim().optional(),
})

// ── Assessment Engine v2 ────────────────────────────────────
export const AutosaveSchema = z.object({
  assessmentId:    z.string().uuid(),
  quiz_responses:  z.record(z.string(), z.unknown()).optional(),
  knowledge_responses_v2: z.record(z.string(), z.unknown()).optional(),
})

export const SubmitAssessmentV2Schema = z.object({
  assessmentId:    z.string().uuid(),
  quiz_responses:  z.record(z.string(), z.unknown()).default({}),
  knowledge_responses_v2: z.record(z.string(), z.unknown()).default({}),
})

export const EvaluatorReviewSchema = z.object({
  assessmentId:    z.string().uuid(),
  quiz_score:      z.number().min(0).max(100).optional(),
  knowledge_score: z.number().min(0).max(100).optional(),
  practical_score: z.number().min(0).max(100).optional(),
  practical_scores: z.record(z.string(), z.object({ done: z.boolean(), score: z.number().optional() })).default({}),
  evaluator_notes: z.string().max(3000).trim().optional().or(z.literal('')),
  practical_results: z.record(z.string(), z.object({ done: z.boolean() })).default({}),
})

export const ReattemptSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
})

// ── Template Engine v2 ──────────────────────────────────────
const QuestionTypeEnum = z.enum(['mcq', 'true_false', 'short_answer', 'rating', 'checklist'])

export const QuizQuestionSchema = z.object({
  id:            z.string().min(1),
  question:      z.string().min(1, 'Question text is required').max(2000),
  type:          QuestionTypeEnum.default('mcq'),
  options:       z.array(z.string().max(500)).default([]),
  correct_index: z.number().int().min(0).default(0),
  correct_answer: z.string().max(2000).optional().or(z.literal('')),
  explanation:   z.string().max(2000).optional().or(z.literal('')),
  required:      z.boolean().default(true),
  max_score:     z.number().min(0).max(100).optional(),
})

export const KnowledgeSectionSchema = z.object({
  id:      z.string().min(1),
  title:   z.string().min(1, 'Section title is required').max(200),
  content: z.string().min(1, 'Content is required').max(10000),
  order:   z.number().int().min(0).default(0),
})

export const PracticalItemSchema = z.object({
  id:          z.string().min(1),
  item:        z.string().min(1, 'Item text is required').max(500),
  category:    z.string().max(100).optional().or(z.literal('')),
  is_critical: z.boolean().default(false),
  order:       z.number().int().min(0).default(0),
})

export const TemplateV2Schema = z.object({
  title:              z.string().min(2, 'Title is required').max(200).trim(),
  category:           z.string().min(1, 'Category is required').max(100).trim(),
  subcategory:        z.string().max(100).trim().optional().or(z.literal('')),
  description:        z.string().max(2000).trim().optional().or(z.literal('')),
  passing_score:      z.coerce.number().int().min(1).max(100).default(80),
  validity_months:    z.coerce.number().int().min(1).max(120).default(12),
  approval_levels:    z.coerce.number().int().min(1).max(5).default(3),
  requires_knowledge: booleanField,
  requires_quiz:      booleanField,
  requires_practical: booleanField,
  is_mandatory:       booleanField,
  is_draft:           booleanField,
  tags:               z.array(z.string().max(50)).max(20).default([]),
  department_id:      z.string().uuid().optional().or(z.literal('')),
  unit_id:            z.string().uuid().optional().or(z.literal('')),
  knowledge_sections: z.array(KnowledgeSectionSchema).default([]),
  quiz_questions:     z.array(QuizQuestionSchema).default([]),
  practical_checklist: z.array(PracticalItemSchema).default([]),
})

export const CloneTemplateSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  newTitle:   z.string().min(2, 'Title is required').max(200).trim(),
})

// ── Branches ────────────────────────────────────────────────
export const BranchSchema = z.object({
  name: z.string().min(2, 'Branch name is required').max(150).trim(),
  name_ar: z.string().max(150).trim().optional().or(z.literal('')),
  city: z.string().max(100).trim().optional().or(z.literal('')),
  address: z.string().max(300).trim().optional().or(z.literal('')),
  contact_email: z.string().email('Invalid email').max(254).optional().or(z.literal('')),
  contact_phone: z.string().max(30).trim().optional().or(z.literal('')),
})

// ── Units ───────────────────────────────────────────────────
export const UnitSchema = z.object({
  department_id: z.string().uuid('Invalid department'),
  branch_id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(2, 'Unit name is required').max(150).trim(),
  name_ar: z.string().max(150).trim().optional().or(z.literal('')),
  head_user_id: z.string().uuid().optional().or(z.literal('')),
})

// ── Departments (update — branch assignment) ────────────────
export const UpdateDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name is required').max(150).trim(),
  name_ar: z.string().max(150).trim().optional().or(z.literal('')),
  branch_id: z.string().uuid().optional().or(z.literal('')),
  head_nurse_id: z.string().uuid().optional().or(z.literal('')),
})

// ── Billing ─────────────────────────────────────────────────

export const HospitalSignupSchema = z.object({
  hospital_name:    z.string().min(2, 'Hospital name is required').max(200).trim(),
  hospital_name_ar: z.string().max(200).trim().optional().or(z.literal('')),
  city:             z.string().max(100).trim().optional().or(z.literal('')),
  region:           z.string().max(100).trim().optional().or(z.literal('')),
  license_number:   z.string().max(80).trim().optional().or(z.literal('')),
  contact_name:     z.string().min(2, 'Contact name is required').max(120).trim(),
  contact_email:    z.string().email('Invalid email').max(254),
  contact_phone:    z.string().max(30).trim().optional().or(z.literal('')),
  plan_id:          z.enum(['trial', 'basic', 'pro', 'enterprise']),
  coupon_code:      z.string().max(50).trim().optional().or(z.literal('')),
  message:          z.string().max(1000).trim().optional().or(z.literal('')),
})

export const CreateSubscriptionSchema = z.object({
  hospital_id:   z.string().uuid('Invalid hospital'),
  plan_id:       z.enum(['trial', 'basic', 'pro', 'enterprise']),
  billing_cycle: z.enum(['monthly', 'yearly']).default('monthly'),
  status:        z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'read_only']).default('trial'),
  notes:         z.string().max(500).trim().optional().or(z.literal('')),
})

export const UpdateSubscriptionSchema = z.object({
  plan_id:        z.enum(['trial', 'basic', 'pro', 'enterprise']).optional(),
  billing_cycle:  z.enum(['monthly', 'yearly']).optional(),
  status:         z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'read_only']).optional(),
  period_end:     z.string().optional().or(z.literal('')),
  price_override: z.coerce.number().min(0).optional().nullable(),
  notes:          z.string().max(500).trim().optional().or(z.literal('')),
})

export const CreateCouponSchema = z.object({
  code:            z.string().min(3, 'Code must be at least 3 characters').max(30).trim(),
  description:     z.string().max(200).trim().optional().or(z.literal('')),
  discount_type:   z.enum(['percent', 'fixed']),
  discount_value:  z.coerce.number().min(1, 'Discount must be at least 1').max(100000),
  applies_to_plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).optional().or(z.literal('')),
  max_uses:        z.coerce.number().int().min(1).optional().nullable(),
  valid_until:     z.string().optional().or(z.literal('')),
})

export const CreateInvoiceSchema = z.object({
  hospital_id:     z.string().uuid('Invalid hospital'),
  subscription_id: z.string().uuid().optional().or(z.literal('')),
  plan_id:         z.enum(['trial', 'basic', 'pro', 'enterprise']).optional().or(z.literal('')),
  amount:          z.coerce.number().min(0, 'Amount must be positive'),
  tax:             z.coerce.number().min(0).optional().default(0),
  payment_method:  z.string().max(50).optional().or(z.literal('')),
  period_start:    z.string().optional().or(z.literal('')),
  period_end:      z.string().optional().or(z.literal('')),
  notes:           z.string().max(500).trim().optional().or(z.literal('')),
})

export const UpdateInvoiceSchema = z.object({
  status:      z.enum(['pending', 'paid', 'void', 'refunded']),
  payment_ref: z.string().max(200).trim().optional().or(z.literal('')),
  notes:       z.string().max(500).trim().optional().or(z.literal('')),
})

export const ValidateCouponSchema = z.object({
  code:    z.string().min(1).max(50).trim(),
  plan_id: z.enum(['trial', 'basic', 'pro', 'enterprise']),
})


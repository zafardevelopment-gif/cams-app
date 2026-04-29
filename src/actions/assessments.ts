'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import {
  CreateAssessmentSchema,
  SubmitAssessmentSchema,
  ProcessApprovalSchema,
  AutosaveSchema,
  SubmitAssessmentV2Schema,
  EvaluatorReviewSchema,
  ReattemptSchema,
} from '@/lib/validations'
import type { ActionResult, QuizQuestion } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

async function getCaller() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from(T.users).select('role, hospital_id, department_id').eq('id', authUser.id).single()
  if (!profile) return null
  return { authUser, admin, profile }
}

function autoScoreQuiz(questions: QuizQuestion[], responses: Record<string, unknown>): number {
  const gradeable = questions.filter((q) => q.type === 'mcq' || q.type === 'true_false')
  if (gradeable.length === 0) return 0
  const correct = gradeable.filter((q) => {
    const ans = responses[q.id]
    return typeof ans === 'number' && ans === q.correct_index
  }).length
  return Math.round((correct / gradeable.length) * 100)
}

// ── CREATE ASSESSMENT ─────────────────────────────────────────────────────────

export async function createAssessment(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    template_id:  formData.get('template_id'),
    staff_id:     formData.get('staff_id'),
    assessor_id:  formData.get('assessor_id'),
    due_date:     formData.get('due_date'),
  }

  const parsed = CreateAssessmentSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { template_id, staff_id, assessor_id, due_date } = parsed.data

  const allowedRoles = ['hospital_admin','super_admin','branch_admin','department_head','unit_head','head_nurse','educator','hr_quality','assessor']
  const targetStaffId = allowedRoles.includes(ctx.profile.role) && staff_id ? staff_id : ctx.authUser.id

  if (targetStaffId !== ctx.authUser.id) {
    const { data: targetUser } = await ctx.admin.from(T.users).select('hospital_id').eq('id', targetStaffId).single()
    if (!targetUser || targetUser.hospital_id !== ctx.profile.hospital_id) {
      return { success: false, error: 'Cannot assign assessment to a user outside your hospital' }
    }
  }

  const { data, error } = await ctx.admin.from(T.assessments).insert({
    template_id,
    staff_id: targetStaffId,
    assessor_id: assessor_id || null,
    hospital_id: ctx.profile.hospital_id,
    department_id: ctx.profile.department_id,
    status: 'not_started',
    attempt_number: 1,
    due_date: due_date || null,
    evidence_urls: [],
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.notifications).insert({
    user_id: targetStaffId,
    type: 'info', category: 'assessments',
    title: 'New Assessment Assigned',
    body: 'A new competency assessment has been assigned to you.',
    action_url: `/assessments/${data.id}`,
    reference_id: data.id, reference_type: 'assessment',
  })

  if (assessor_id) {
    await ctx.admin.from(T.notifications).insert({
      user_id: assessor_id,
      type: 'info', category: 'assessments',
      title: 'Assessment Evaluation Requested',
      body: 'You have been assigned to evaluate a competency assessment.',
      action_url: `/assessments/${data.id}`,
      reference_id: data.id, reference_type: 'assessment',
    })
  }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'create_assessment', entity_type: 'assessment', entity_id: data.id,
    description: `Assessment created for template ${template_id}, staff ${targetStaffId}`,
    metadata: { template_id, staff_id: targetStaffId, assessor_id: assessor_id || null },
  })

  revalidatePath('/assessments')
  return { success: true, data: { id: data.id } }
}

// ── AUTOSAVE ──────────────────────────────────────────────────────────────────

export async function autosaveAssessment(
  assessmentId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = AutosaveSchema.safeParse({ assessmentId, ...data })
  if (!parsed.success) return { success: false, error: 'Invalid data' }

  const { data: existing } = await ctx.admin
    .from(T.assessments).select('staff_id, status').eq('id', assessmentId).single()

  if (!existing) return { success: false, error: 'Assessment not found' }
  if (existing.staff_id !== ctx.authUser.id) return { success: false, error: 'Unauthorized' }
  if (!['not_started', 'in_progress'].includes(existing.status)) return { success: false, error: 'Cannot autosave at this stage' }

  await ctx.admin.from(T.assessments).update({
    autosave_data: data,
    autosaved_at: new Date().toISOString(),
    status: 'in_progress',
    started_at: existing.status === 'not_started' ? new Date().toISOString() : undefined,
  }).eq('id', assessmentId)

  return { success: true }
}

// ── SUBMIT (staff submits own responses) ──────────────────────────────────────

export async function submitAssessmentV2(
  assessmentId: string,
  payload: {
    quiz_responses: Record<string, unknown>
    knowledge_responses_v2: Record<string, unknown>
  }
): Promise<ActionResult> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = SubmitAssessmentV2Schema.safeParse({ assessmentId, ...payload })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: assessment } = await ctx.admin
    .from(T.assessments)
    .select(`*, template:${J.competency_templates}!template_id(passing_score, approval_levels, title, quiz_questions)`)
    .eq('id', assessmentId).single()

  if (!assessment) return { success: false, error: 'Assessment not found' }
  if (assessment.staff_id !== ctx.authUser.id) return { success: false, error: 'Unauthorized' }
  if (!['not_started', 'in_progress'].includes(assessment.status)) {
    return { success: false, error: 'Assessment already submitted' }
  }

  const template = (Array.isArray(assessment.template) ? assessment.template[0] : assessment.template) as {
    passing_score: number; approval_levels: number; title: string
    quiz_questions?: QuizQuestion[]
  } | null

  // Auto-score MCQ/TF questions
  const quizQs = template?.quiz_questions ?? []
  const autoScore = quizQs.length > 0 ? autoScoreQuiz(quizQs, parsed.data.quiz_responses) : null

  await ctx.admin.from(T.assessments).update({
    quiz_responses: parsed.data.quiz_responses,
    knowledge_responses_v2: parsed.data.knowledge_responses_v2,
    quiz_auto_score: autoScore,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    autosave_data: null,
  }).eq('id', assessmentId)

  await ctx.admin.from(T.notifications).insert({
    user_id: assessment.staff_id,
    type: 'info', category: 'assessments',
    title: 'Assessment Submitted',
    body: `Your assessment for "${template?.title ?? 'competency'}" has been submitted for review.`,
    action_url: `/assessments/${assessmentId}`,
    reference_id: assessmentId, reference_type: 'assessment',
  })

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'submit_assessment', entity_type: 'assessment', entity_id: assessmentId,
    description: `Assessment submitted (auto-quiz score: ${autoScore ?? 'N/A'}%)`,
    metadata: { quiz_auto_score: autoScore },
  })

  revalidatePath(`/assessments/${assessmentId}`)
  revalidatePath('/assessments')
  return { success: true }
}

// ── EVALUATOR REVIEW (assessor scores and sends to approval) ──────────────────

export async function evaluatorReview(
  assessmentId: string,
  payload: {
    quiz_score?: number
    knowledge_score?: number
    practical_score?: number
    practical_scores?: Record<string, { done: boolean; score?: number }>
    practical_results?: Record<string, { done: boolean }>
    evaluator_notes?: string
  }
): Promise<ActionResult> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = EvaluatorReviewSchema.safeParse({ assessmentId, ...payload })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const EVALUATOR_ROLES = ['assessor','educator','hospital_admin','super_admin','branch_admin','department_head','unit_head','head_nurse','hr_quality']
  if (!EVALUATOR_ROLES.includes(ctx.profile.role)) return { success: false, error: 'Insufficient permissions' }

  const { data: assessment } = await ctx.admin
    .from(T.assessments)
    .select(`*, template:${J.competency_templates}!template_id(passing_score, approval_levels, title, quiz_questions)`)
    .eq('id', assessmentId).single()

  if (!assessment) return { success: false, error: 'Assessment not found' }
  if (!['submitted','assessor_review'].includes(assessment.status)) {
    return { success: false, error: 'Assessment is not ready for evaluator review' }
  }
  if (ctx.profile.role !== 'super_admin' && assessment.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Cannot evaluate assessments outside your hospital' }
  }

  const template = (Array.isArray(assessment.template) ? assessment.template[0] : assessment.template) as {
    passing_score: number; approval_levels: number; title: string; quiz_questions?: QuizQuestion[]
  } | null

  // Use manual quiz_score if provided, else fall back to auto-score
  const effectiveQuizScore = parsed.data.quiz_score ?? (assessment.quiz_auto_score ?? undefined)

  const scoreFields = [parsed.data.knowledge_score, effectiveQuizScore, parsed.data.practical_score]
    .filter((s): s is number => s != null)
  const overall = scoreFields.length > 0
    ? Math.round((scoreFields.reduce((a, b) => a + b, 0) / scoreFields.length) * 100) / 100
    : null

  const approvalLevels = template?.approval_levels ?? 3

  await ctx.admin.from(T.assessments).update({
    knowledge_score:  parsed.data.knowledge_score ?? null,
    quiz_score:       effectiveQuizScore ?? null,
    practical_score:  parsed.data.practical_score ?? null,
    practical_scores: parsed.data.practical_scores,
    practical_results: parsed.data.practical_results,
    evaluator_notes:  parsed.data.evaluator_notes || null,
    overall_score:    overall,
    status:           'assessor_review',
    assessor_id:      assessment.assessor_id ?? ctx.authUser.id,
  }).eq('id', assessmentId)

  // Create approval chain if not yet created
  const { count: existingApprovals } = await ctx.admin
    .from(T.approvals).select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId)

  if (!existingApprovals || existingApprovals === 0) {
    const levelRoles = ['assessor', 'unit_head', 'hospital_admin']
    const approvalInserts = Array.from({ length: approvalLevels }, (_, i) => ({
      assessment_id: assessmentId,
      approver_id: ctx.authUser.id,
      approver_role: levelRoles[i] ?? 'hospital_admin',
      level: i + 1,
      status: 'pending',
    }))
    await ctx.admin.from(T.approvals).insert(approvalInserts)
  }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'evaluator_review', entity_type: 'assessment', entity_id: assessmentId,
    description: `Evaluator review completed. Overall: ${overall ?? 'N/A'}%`,
    metadata: { overall_score: overall },
  })

  revalidatePath(`/assessments/${assessmentId}`)
  revalidatePath('/assessments')
  return { success: true }
}

// ── LEGACY SUBMIT (kept for backward compat) ──────────────────────────────────

export async function submitAssessment(
  assessmentId: string,
  scores: {
    knowledge_score?: number; quiz_score?: number; practical_score?: number
    knowledge_responses?: Record<string, unknown>; quiz_responses?: Record<string, unknown>
    practical_results?: Record<string, unknown>; assessor_notes?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const parsed = SubmitAssessmentSchema.safeParse({ assessmentId, ...scores })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const { data: assessment } = await admin
    .from(T.assessments)
    .select(`*, template:${J.competency_templates}(passing_score, approval_levels, title)`)
    .eq('id', assessmentId).single()

  if (!assessment) return { success: false, error: 'Assessment not found' }

  if (assessment.staff_id !== authUser.id && assessment.assessor_id !== authUser.id) {
    const { data: profile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser.id).single()
    if (!profile || !['hospital_admin','super_admin','branch_admin','department_head','unit_head','head_nurse','educator','hr_quality'].includes(profile.role) || profile.hospital_id !== assessment.hospital_id) {
      return { success: false, error: 'Not authorized to submit this assessment' }
    }
  }

  const template = (Array.isArray(assessment.template) ? assessment.template[0] : assessment.template) as { passing_score: number; approval_levels: number; title: string } | null
  const scoreFields = [scores.knowledge_score, scores.quiz_score, scores.practical_score].filter((s): s is number => s != null)
  const overall = scoreFields.length > 0 ? Math.round((scoreFields.reduce((a, b) => a + b, 0) / scoreFields.length) * 100) / 100 : null

  const { error } = await admin.from(T.assessments).update({
    knowledge_score: scores.knowledge_score ?? null,
    quiz_score: scores.quiz_score ?? null,
    practical_score: scores.practical_score ?? null,
    knowledge_responses: scores.knowledge_responses ?? {},
    quiz_responses: scores.quiz_responses ?? {},
    practical_results: scores.practical_results ?? {},
    assessor_notes: scores.assessor_notes ?? null,
    overall_score: overall,
    status: 'assessor_review',
    submitted_at: new Date().toISOString(),
  }).eq('id', assessmentId)

  if (error) return { success: false, error: error.message }

  if (template?.approval_levels) {
    const levelRoles = ['assessor', 'unit_head', 'hospital_admin']
    const approvalInserts = Array.from({ length: template.approval_levels }, (_, i) => ({
      assessment_id: assessmentId,
      approver_id: authUser.id,
      approver_role: levelRoles[i] ?? 'hospital_admin',
      level: i + 1,
      status: 'pending',
    }))
    await admin.from(T.approvals).insert(approvalInserts)
  }

  await admin.from(T.notifications).insert({
    user_id: assessment.staff_id,
    type: 'info', category: 'assessments',
    title: 'Assessment Submitted',
    body: `Your assessment for "${template?.title ?? 'competency'}" has been submitted for review.`,
    action_url: `/assessments/${assessmentId}`,
    reference_id: assessmentId, reference_type: 'assessment',
  })

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id,
    action: 'submit_assessment', entity_type: 'assessment', entity_id: assessmentId,
    description: `Assessment submitted with overall score ${overall ?? 'N/A'}%`,
    metadata: { overall_score: overall },
  })

  revalidatePath(`/assessments/${assessmentId}`)
  revalidatePath('/assessments')
  return { success: true }
}

// ── PROCESS APPROVAL ──────────────────────────────────────────────────────────

export async function processApproval(
  approvalId: string,
  action: 'approved' | 'rejected',
  comments?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { success: false, error: 'Unauthorized' }

  const parsed = ProcessApprovalSchema.safeParse({ approvalId, action, comments })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()

  const { data: approval } = await admin
    .from(T.approvals)
    .select(`*, assessment:${J.assessments}(id, staff_id, overall_score, hospital_id, template_id, template:${J.competency_templates}(passing_score, approval_levels, validity_months, title))`)
    .eq('id', approvalId).single()

  if (!approval) return { success: false, error: 'Approval not found' }

  const { data: callerProfile } = await admin.from(T.users).select('role, hospital_id').eq('id', authUser.id).single()
  if (!callerProfile) return { success: false, error: 'Profile not found' }

  const assessment = (Array.isArray(approval.assessment) ? approval.assessment[0] : approval.assessment) as {
    id: string; staff_id: string; overall_score: number; hospital_id: string; template_id: string
    template: { passing_score: number; approval_levels: number; validity_months: number; title: string } | { passing_score: number; approval_levels: number; validity_months: number; title: string }[]
  } | null

  if (!assessment) return { success: false, error: 'Assessment not found' }
  if (callerProfile.hospital_id !== assessment.hospital_id && callerProfile.role !== 'super_admin') {
    return { success: false, error: 'Not authorized to approve assessments outside your hospital' }
  }

  await admin.from(T.approvals).update({
    status: action, comments: comments ?? null,
    approver_id: authUser.id, approved_at: new Date().toISOString(),
  }).eq('id', approvalId)

  const template = (Array.isArray(assessment.template) ? assessment.template[0] : assessment.template) as {
    passing_score: number; approval_levels: number; validity_months: number; title: string
  } | null

  if (action === 'rejected') {
    await admin.from(T.assessments).update({ status: 'failed' }).eq('id', approval.assessment_id)
    await admin.from(T.notifications).insert({
      user_id: assessment.staff_id, type: 'danger', category: 'assessments',
      title: 'Assessment Not Approved',
      body: comments || `Your assessment for "${template?.title ?? 'competency'}" was not approved.`,
      action_url: `/assessments/${approval.assessment_id}`,
      reference_id: approval.assessment_id, reference_type: 'assessment',
    })
    await admin.from(T.activity_logs).insert({
      user_id: authUser.id, action: 'reject_approval', entity_type: 'approval', entity_id: approvalId,
      description: `Approval level ${approval.level} rejected`, metadata: { level: approval.level, comments },
    })
    revalidatePath(`/assessments/${approval.assessment_id}`)
    return { success: true }
  }

  const { data: allApprovals } = await admin.from(T.approvals).select('status, level').eq('assessment_id', approval.assessment_id)
  const totalLevels = template?.approval_levels ?? 3
  const approvedCount = allApprovals?.filter((a) => a.status === 'approved').length ?? 0

  if (approvedCount >= totalLevels) {
    const passingScore = template?.passing_score ?? 80
    const finalStatus = (assessment.overall_score ?? 0) >= passingScore ? 'passed' : 'failed'

    await admin.from(T.assessments).update({ status: finalStatus, completed_at: new Date().toISOString() }).eq('id', approval.assessment_id)

    if (finalStatus === 'passed') {
      const expiryDate = new Date()
      expiryDate.setMonth(expiryDate.getMonth() + (template?.validity_months ?? 12))
      const certNumber = `CAMS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`

      await admin.from(T.certificates).insert({
        certificate_number: certNumber,
        assessment_id: approval.assessment_id,
        staff_id: assessment.staff_id,
        template_id: assessment.template_id,
        hospital_id: assessment.hospital_id,
        issued_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        overall_score: assessment.overall_score,
        status: 'active',
        issued_by: authUser.id,
      })

      await admin.from(T.notifications).insert({
        user_id: assessment.staff_id, type: 'success', category: 'certificates',
        title: 'Certificate Issued!',
        body: `Your competency certificate for "${template?.title ?? 'competency'}" has been issued. #${certNumber}`,
        action_url: '/certificates', reference_type: 'certificate',
      })

      await admin.from(T.activity_logs).insert({
        user_id: authUser.id, action: 'issue_certificate', entity_type: 'assessment', entity_id: approval.assessment_id,
        description: `Certificate issued: ${certNumber}`,
        metadata: { certificate_number: certNumber, overall_score: assessment.overall_score },
      })
    } else {
      await admin.from(T.notifications).insert({
        user_id: assessment.staff_id, type: 'danger', category: 'assessments',
        title: 'Assessment Result: Not Passed',
        body: `Your assessment for "${template?.title ?? 'competency'}" did not meet the passing score.`,
        action_url: `/assessments/${approval.assessment_id}`,
        reference_id: approval.assessment_id, reference_type: 'assessment',
      })
    }
  } else {
    const nextStatus = approval.level === 1 ? 'head_nurse_review' : 'admin_review'
    await admin.from(T.assessments).update({ status: nextStatus }).eq('id', approval.assessment_id)
  }

  await admin.from(T.activity_logs).insert({
    user_id: authUser.id, action: 'approve_approval', entity_type: 'approval', entity_id: approvalId,
    description: `Approval level ${approval.level} approved`, metadata: { level: approval.level, comments },
  })

  revalidatePath(`/assessments/${approval.assessment_id}`)
  revalidatePath('/assessments')
  return { success: true }
}

// ── REATTEMPT ─────────────────────────────────────────────────────────────────

export async function reattemptAssessment(assessmentId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = ReattemptSchema.safeParse({ assessmentId })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid' }

  const { data: original } = await ctx.admin
    .from(T.assessments)
    .select('*')
    .eq('id', assessmentId).single()

  if (!original) return { success: false, error: 'Assessment not found' }
  if (original.staff_id !== ctx.authUser.id && ctx.profile.role !== 'super_admin' && original.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Unauthorized' }
  }
  if (!['failed', 'passed'].includes(original.status)) {
    return { success: false, error: 'Can only reattempt completed assessments' }
  }

  const { data, error } = await ctx.admin.from(T.assessments).insert({
    template_id:    original.template_id,
    staff_id:       original.staff_id,
    assessor_id:    original.assessor_id,
    hospital_id:    original.hospital_id,
    department_id:  original.department_id,
    branch_id:      original.branch_id,
    unit_id:        original.unit_id,
    status:         'not_started',
    attempt_number: (original.attempt_number ?? 1) + 1,
    reattempt_of:   original.id,
    due_date:       original.due_date,
    evidence_urls:  [],
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'reattempt_assessment', entity_type: 'assessment', entity_id: data.id,
    description: `Reattempt #${(original.attempt_number ?? 1) + 1} created for ${original.template_id}`,
    metadata: { original_id: original.id },
  })

  revalidatePath('/assessments')
  return { success: true, data: { id: data.id } }
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T, J } from '@/lib/db'
import { TakeAssessmentClient } from './TakeAssessmentClient'
import { EvaluatorClient } from './EvaluatorClient'
import { ApprovalClient } from './ApprovalClient'

export const dynamic = 'force-dynamic'

function resolveJoin<T>(raw: unknown): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw as T)
}

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ data: callerProfile }, { data: assessment }] = await Promise.all([
    admin.from(T.users).select('role, hospital_id').eq('id', authUser!.id).single(),
    admin.from(T.assessments)
      .select(`*,
        staff:${J.users}!staff_id(id, full_name, job_title, department:${J.departments}!department_id(name)),
        assessor:${J.users}!assessor_id(id, full_name),
        template:${J.competency_templates}!template_id(
          id, title, category, passing_score, approval_levels, validity_months,
          requires_knowledge, requires_quiz, requires_practical,
          knowledge_sections, quiz_questions, practical_checklist
        ),
        approvals:${J.approvals}(id, level, status, comments, approved_at,
          approver:${J.users}!approver_id(full_name))
      `)
      .eq('id', id)
      .single(),
  ])

  if (!assessment) notFound()

  const staff    = resolveJoin<{ id: string; full_name: string; job_title?: string; department?: unknown }>(assessment.staff)
  const assessor = resolveJoin<{ id: string; full_name: string }>(assessment.assessor)
  const template = resolveJoin<{
    id: string; title: string; category: string
    passing_score: number; approval_levels: number; validity_months: number
    requires_knowledge: boolean; requires_quiz: boolean; requires_practical: boolean
    knowledge_sections: unknown[]; quiz_questions: unknown[]; practical_checklist: unknown[]
  }>(assessment.template)
  const approvals = (Array.isArray(assessment.approvals) ? assessment.approvals : []) as {
    id: string; level: number; status: string; comments?: string; approved_at?: string
    approver?: unknown
  }[]

  if (!template) notFound()

  const callerRole = callerProfile?.role ?? 'staff'
  const isStaff    = assessment.staff_id === authUser!.id
  const isAssessor = assessment.assessor_id === authUser!.id
  const isAdmin    = ['hospital_admin','super_admin','branch_admin','department_head','unit_head','head_nurse','hr_quality','educator','assessor'].includes(callerRole)

  // Route to correct view
  const canTake      = isStaff && ['not_started', 'in_progress'].includes(assessment.status)
  const canEvaluate  = (isAssessor || (isAdmin && !isStaff)) && ['submitted', 'assessor_review'].includes(assessment.status)
  const showApproval = !canTake && !canEvaluate

  const dept = resolveJoin<{ name: string }>(staff?.department)
  const totalLevels = template.approval_levels ?? 3

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <Link href="/assessments" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>← Assessments</Link>
          <h1 style={{ marginTop: 4 }}>{template.title}</h1>
          <p>
            {staff?.full_name ?? '—'} · Attempt #{assessment.attempt_number}
            {assessment.reattempt_of && ' (reattempt)'}
            {dept ? ` · ${dept.name}` : ''}
          </p>
        </div>
        <div className="page-header-actions">
          {assessment.status === 'passed' && (
            <Link href="/certificates" className="btn btn-secondary btn-sm">🏅 Certificate</Link>
          )}
          <Link href={`/competencies/${template.id}/preview`} className="btn btn-secondary btn-sm">Template</Link>
        </div>
      </div>

      {/* Info bar */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
          <span><strong>Assessor:</strong> {assessor?.full_name ?? 'Not assigned'}</span>
          {assessment.due_date && <span><strong>Due:</strong> {new Date(assessment.due_date).toLocaleDateString()}</span>}
          {assessment.submitted_at && <span><strong>Submitted:</strong> {new Date(assessment.submitted_at).toLocaleDateString()}</span>}
          {assessment.autosaved_at && canTake && (
            <span style={{ color: 'var(--gray-400)' }}>Draft saved {new Date(assessment.autosaved_at).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* ── Take assessment ─────────────────────────────────────────────────── */}
      {canTake && (
        <TakeAssessmentClient
          assessmentId={id}
          template={{
            title: template.title,
            passing_score: template.passing_score,
            requires_knowledge: template.requires_knowledge,
            requires_quiz: template.requires_quiz,
            requires_practical: template.requires_practical,
            knowledge_sections: (template.knowledge_sections ?? []) as import('@/types').KnowledgeSection[],
            quiz_questions: (template.quiz_questions ?? []) as import('@/types').QuizQuestion[],
          }}
          initialDraft={(assessment.autosave_data as Record<string, unknown>) ?? undefined}
        />
      )}

      {/* ── Evaluator review ────────────────────────────────────────────────── */}
      {canEvaluate && (
        <EvaluatorClient
          assessmentId={id}
          staffName={staff?.full_name ?? '—'}
          template={{
            title: template.title,
            passing_score: template.passing_score,
            requires_knowledge: template.requires_knowledge,
            requires_quiz: template.requires_quiz,
            requires_practical: template.requires_practical,
            quiz_questions: (template.quiz_questions ?? []) as import('@/types').QuizQuestion[],
            practical_checklist: (template.practical_checklist ?? []) as import('@/types').PracticalItem[],
          }}
          assessment={{
            quiz_auto_score: assessment.quiz_auto_score ?? undefined,
            knowledge_responses_v2: (assessment.knowledge_responses_v2 as Record<string, unknown>) ?? undefined,
            quiz_responses: (assessment.quiz_responses as Record<string, unknown>) ?? undefined,
            practical_results: (assessment.practical_results as Record<string, { done: boolean }>) ?? undefined,
            evaluator_notes: assessment.evaluator_notes ?? undefined,
          }}
        />
      )}

      {/* ── Approval / result view ───────────────────────────────────────────── */}
      {showApproval && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Left: scores (read-only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Submission Overview</div></div>
              <div className="card-body">
                <div className="stat-row"><span className="stat-label">Staff</span><span className="stat-value">{staff?.full_name ?? '—'}</span></div>
                <div className="stat-row"><span className="stat-label">Department</span><span className="stat-value">{dept?.name ?? '—'}</span></div>
                <div className="stat-row"><span className="stat-label">Assessor</span><span className="stat-value">{assessor?.full_name ?? '—'}</span></div>
                {assessment.started_at && <div className="stat-row"><span className="stat-label">Started</span><span className="stat-value">{new Date(assessment.started_at).toLocaleDateString()}</span></div>}
                {assessment.submitted_at && <div className="stat-row"><span className="stat-label">Submitted</span><span className="stat-value">{new Date(assessment.submitted_at).toLocaleDateString()}</span></div>}
              </div>
            </div>

            {(assessment.knowledge_score != null || assessment.quiz_score != null || assessment.practical_score != null) && (
              <div className="card">
                <div className="card-header"><div className="card-title">Scores</div></div>
                <div className="card-body">
                  {assessment.knowledge_score != null && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="flex-between mb-4"><span className="text-sm fw-600">Knowledge</span><span className="text-sm fw-600">{assessment.knowledge_score}%</span></div>
                      <div className="progress-bar-wrap"><div className="progress-bar-fill progress-blue" style={{ width: `${assessment.knowledge_score}%` }} /></div>
                    </div>
                  )}
                  {assessment.quiz_score != null && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="flex-between mb-4"><span className="text-sm fw-600">Quiz</span><span className="text-sm fw-600">{assessment.quiz_score}%</span></div>
                      <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${assessment.quiz_score}%`, background: 'var(--purple)' }} /></div>
                    </div>
                  )}
                  {assessment.practical_score != null && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="flex-between mb-4"><span className="text-sm fw-600">Practical</span><span className="text-sm fw-600">{assessment.practical_score}%</span></div>
                      <div className="progress-bar-wrap"><div className="progress-bar-fill progress-teal" style={{ width: `${assessment.practical_score}%` }} /></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: approval chain + actions */}
          <ApprovalClient
            assessmentId={id}
            status={assessment.status}
            overall_score={assessment.overall_score ?? undefined}
            passing_score={template.passing_score}
            attempt_number={assessment.attempt_number}
            approvals={approvals as import('@/app/(dashboard)/assessments/[id]/ApprovalClient').ApprovalRow[]}
            totalLevels={totalLevels}
            callerRole={callerRole}
            isStaff={isStaff}
            knowledge_score={assessment.knowledge_score ?? undefined}
            quiz_score={assessment.quiz_score ?? undefined}
            practical_score={assessment.practical_score ?? undefined}
            quiz_auto_score={assessment.quiz_auto_score ?? undefined}
            evaluator_notes={assessment.evaluator_notes ?? undefined}
            assessor_notes={assessment.assessor_notes ?? undefined}
            templateTitle={template.title}
            staffName={staff?.full_name ?? '—'}
          />
        </div>
      )}
    </>
  )
}

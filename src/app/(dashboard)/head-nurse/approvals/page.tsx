import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T, J } from '@/lib/db'
import ApprovalCard from '@/components/approvals/ApprovalCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pending Approvals — CAMS' }

export default async function HeadNurseApprovalsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: approvals } = await admin
    .from(T.approvals)
    .select(`id, level, assessment_id, assessment:${J.assessments}!assessment_id(id, overall_score, submitted_at, staff:${J.users}!staff_id(full_name, job_title), template:${J.competency_templates}!template_id(title, category, passing_score))`)
    .eq('status', 'pending')
    .eq('approver_role', 'head_nurse')
    .order('created_at')

  const list = approvals ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Pending Approvals</h1>
          <p>{list.length} assessments awaiting your approval</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p>No pending approvals — all clear!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {list.map((ap) => {
            const assessmentRaw = ap.assessment as unknown
            const assessment = Array.isArray(assessmentRaw) ? assessmentRaw[0] : assessmentRaw as {
              id: string; overall_score: number; submitted_at: string;
              staff?: { full_name: string; job_title: string } | { full_name: string; job_title: string }[];
              template?: { title: string; category: string; passing_score: number } | { title: string; category: string; passing_score: number }[];
            } | null
            const staffRaw = assessment?.staff
            const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw as { full_name: string; job_title: string } | null
            const templateRaw = assessment?.template
            const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw as { title: string; category: string; passing_score: number } | null
            return (
              <ApprovalCard
                key={ap.id}
                approvalId={ap.id}
                level={ap.level}
                assessmentId={ap.assessment_id}
                staffName={staff?.full_name ?? '—'}
                jobTitle={staff?.job_title ?? '—'}
                templateTitle={template?.title ?? '—'}
                templateCategory={template?.category ?? '—'}
                passingScore={template?.passing_score ?? 80}
                overallScore={assessment?.overall_score ?? 0}
                submittedAt={assessment?.submitted_at ?? new Date().toISOString()}
              />
            )
          })}
        </div>
      )}
    </>
  )
}

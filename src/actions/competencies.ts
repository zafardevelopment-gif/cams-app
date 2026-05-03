'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { TemplateSchema, TemplateV2Schema, CloneTemplateSchema } from '@/lib/validations'
import type { ActionResult } from '@/types'

const EDITOR_ROLES = ['hospital_admin', 'super_admin', 'educator', 'hr_quality']

async function getEditorCaller() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()
  if (!profile || !EDITOR_ROLES.includes(profile.role)) return null
  return { authUser, admin, profile }
}

// Records only changed scalar fields to CAMS_template_history
async function recordTemplateHistory(
  admin: ReturnType<typeof createAdminClient>,
  templateId: string,
  changedBy: string,
  version: number,
  fields: Array<{ field: string; oldVal: unknown; newVal: unknown }>
) {
  const rows = fields
    .filter((f) => JSON.stringify(f.oldVal) !== JSON.stringify(f.newVal))
    .map((f) => ({
      template_id: templateId,
      changed_by:  changedBy,
      version,
      field_name:  f.field,
      old_value:   f.oldVal != null ? String(f.oldVal) : null,
      new_value:   f.newVal != null ? String(f.newVal) : null,
    }))
  if (rows.length > 0) {
    await admin.from(T.template_history).insert(rows)
  }
}

// ── CREATE (legacy TemplateForm) ──────────────────────────────────────────────

export async function createTemplate(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const raw = {
    title: formData.get('title'),
    category: formData.get('category'),
    subcategory: formData.get('subcategory'),
    description: formData.get('description'),
    passing_score: formData.get('passing_score'),
    validity_months: formData.get('validity_months'),
    approval_levels: formData.get('approval_levels'),
    requires_knowledge: formData.get('requires_knowledge'),
    requires_quiz: formData.get('requires_quiz'),
    requires_practical: formData.get('requires_practical'),
    is_mandatory: formData.get('is_mandatory'),
  }

  const parsed = TemplateSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data, error } = await ctx.admin.from(T.competency_templates).insert({
    ...parsed.data,
    is_active: true,
    is_draft: false,
    version: 1,
    tags: [],
    created_by: ctx.authUser.id,
    hospital_id: ctx.profile.role === 'super_admin' ? null : ctx.profile.hospital_id,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'create_template',
    entity_type: 'competency_template',
    entity_id: data.id,
    description: `Created template "${parsed.data.title}"`,
    metadata: { title: parsed.data.title, category: parsed.data.category },
  })

  revalidatePath('/competencies')
  redirect('/competencies')
}

// ── UPDATE (legacy TemplateForm) ──────────────────────────────────────────────

export async function updateTemplate(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.competency_templates)
    .select('hospital_id, title, version')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Template not found' }
  if (ctx.profile.role !== 'super_admin' && existing.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Cannot edit templates from a different hospital' }
  }

  const raw = {
    title: formData.get('title'),
    category: formData.get('category'),
    subcategory: formData.get('subcategory'),
    description: formData.get('description'),
    passing_score: formData.get('passing_score'),
    validity_months: formData.get('validity_months'),
    approval_levels: formData.get('approval_levels'),
    requires_knowledge: formData.get('requires_knowledge'),
    requires_quiz: formData.get('requires_quiz'),
    requires_practical: formData.get('requires_practical'),
    is_mandatory: formData.get('is_mandatory'),
  }

  const parsed = TemplateSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const newVersion = (existing.version ?? 1) + 1

  const { error } = await ctx.admin.from(T.competency_templates).update({
    ...parsed.data,
    version: newVersion,
    updated_by: ctx.authUser.id,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  await recordTemplateHistory(ctx.admin, id, ctx.authUser.id, newVersion, [
    { field: 'title',           oldVal: existing.title,     newVal: parsed.data.title },
    { field: 'passing_score',   oldVal: undefined,          newVal: parsed.data.passing_score },
    { field: 'validity_months', oldVal: undefined,          newVal: parsed.data.validity_months },
  ])

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_template',
    entity_type: 'competency_template',
    entity_id: id,
    description: `Updated template "${existing.title}" → "${parsed.data.title}" (v${newVersion})`,
  })

  revalidatePath('/competencies')
  redirect('/competencies')
}

// ── SAVE V2 (full builder — JSON body, not FormData) ──────────────────────────

export async function saveTemplateV2(
  id: string | null,
  payload: unknown
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = TemplateV2Schema.safeParse(payload)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const hospitalId = ctx.profile.role === 'super_admin' ? null : ctx.profile.hospital_id

  if (!id) {
    // Create
    const { data, error } = await ctx.admin.from(T.competency_templates).insert({
      title:               parsed.data.title,
      category:            parsed.data.category,
      subcategory:         parsed.data.subcategory || null,
      description:         parsed.data.description || null,
      passing_score:       parsed.data.passing_score,
      validity_months:     parsed.data.validity_months,
      approval_levels:     parsed.data.approval_levels,
      requires_knowledge:  parsed.data.requires_knowledge,
      requires_quiz:       parsed.data.requires_quiz,
      requires_practical:  parsed.data.requires_practical,
      is_mandatory:        parsed.data.is_mandatory,
      is_draft:            parsed.data.is_draft,
      tags:                parsed.data.tags,
      department_id:       parsed.data.department_id || null,
      unit_id:             parsed.data.unit_id || null,
      knowledge_sections:  parsed.data.knowledge_sections,
      quiz_questions:      parsed.data.quiz_questions,
      practical_checklist: parsed.data.practical_checklist,
      version:             1,
      is_active:           true,
      created_by:          ctx.authUser.id,
      updated_by:          ctx.authUser.id,
      hospital_id:         hospitalId,
    }).select('id').single()

    if (error) return { success: false, error: error.message }

    await ctx.admin.from(T.activity_logs).insert({
      user_id: ctx.authUser.id,
      action: 'create_template',
      entity_type: 'competency_template',
      entity_id: data.id,
      description: `Created template "${parsed.data.title}"${parsed.data.is_draft ? ' (draft)' : ''}`,
    })

    revalidatePath('/competencies')
    return { success: true, data: { id: data.id } }
  }

  // Update
  const { data: existing } = await ctx.admin
    .from(T.competency_templates)
    .select('hospital_id, title, version, category, passing_score, validity_months, is_draft, tags, department_id, unit_id')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Template not found' }
  if (ctx.profile.role !== 'super_admin' && existing.hospital_id !== hospitalId) {
    return { success: false, error: 'Cannot edit templates from a different hospital' }
  }

  const newVersion = (existing.version ?? 1) + 1

  const { error } = await ctx.admin.from(T.competency_templates).update({
    title:               parsed.data.title,
    category:            parsed.data.category,
    subcategory:         parsed.data.subcategory || null,
    description:         parsed.data.description || null,
    passing_score:       parsed.data.passing_score,
    validity_months:     parsed.data.validity_months,
    approval_levels:     parsed.data.approval_levels,
    requires_knowledge:  parsed.data.requires_knowledge,
    requires_quiz:       parsed.data.requires_quiz,
    requires_practical:  parsed.data.requires_practical,
    is_mandatory:        parsed.data.is_mandatory,
    is_draft:            parsed.data.is_draft,
    tags:                parsed.data.tags,
    department_id:       parsed.data.department_id || null,
    unit_id:             parsed.data.unit_id || null,
    knowledge_sections:  parsed.data.knowledge_sections,
    quiz_questions:      parsed.data.quiz_questions,
    practical_checklist: parsed.data.practical_checklist,
    version:             newVersion,
    updated_by:          ctx.authUser.id,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  await recordTemplateHistory(ctx.admin, id, ctx.authUser.id, newVersion, [
    { field: 'title',               oldVal: existing.title,         newVal: parsed.data.title },
    { field: 'category',            oldVal: existing.category,      newVal: parsed.data.category },
    { field: 'passing_score',       oldVal: existing.passing_score, newVal: parsed.data.passing_score },
    { field: 'validity_months',     oldVal: existing.validity_months, newVal: parsed.data.validity_months },
    { field: 'is_draft',            oldVal: existing.is_draft,      newVal: parsed.data.is_draft },
    { field: 'tags',                oldVal: JSON.stringify(existing.tags ?? []), newVal: JSON.stringify(parsed.data.tags) },
    { field: 'department_id',       oldVal: existing.department_id, newVal: parsed.data.department_id || null },
    { field: 'unit_id',             oldVal: existing.unit_id,       newVal: parsed.data.unit_id || null },
  ])

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'update_template',
    entity_type: 'competency_template',
    entity_id: id,
    description: `Updated template "${parsed.data.title}" (v${newVersion})${parsed.data.is_draft ? ' — draft' : ''}`,
  })

  revalidatePath('/competencies')
  revalidatePath(`/competencies/${id}/edit`)
  return { success: true, data: { id } }
}

// ── CLONE ─────────────────────────────────────────────────────────────────────

export async function cloneTemplate(
  templateId: string,
  newTitle: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const parsed = CloneTemplateSchema.safeParse({ templateId, newTitle })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: src } = await ctx.admin
    .from(T.competency_templates)
    .select('*')
    .eq('id', parsed.data.templateId)
    .single()

  if (!src) return { success: false, error: 'Source template not found' }
  // Allow cloning sample templates (hospital_id = null); block cloning other hospitals' templates
  if (ctx.profile.role !== 'super_admin' && src.hospital_id !== null && src.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Cannot clone templates from a different hospital' }
  }

  const { data, error } = await ctx.admin.from(T.competency_templates).insert({
    title:               parsed.data.newTitle,
    category:            src.category,
    subcategory:         src.subcategory,
    description:         src.description,
    passing_score:       src.passing_score,
    validity_months:     src.validity_months,
    approval_levels:     src.approval_levels,
    requires_knowledge:  src.requires_knowledge,
    requires_quiz:       src.requires_quiz,
    requires_practical:  src.requires_practical,
    is_mandatory:        src.is_mandatory,
    is_draft:            true,
    tags:                src.tags ?? [],
    department_id:       src.department_id,
    unit_id:             src.unit_id,
    knowledge_sections:  src.knowledge_sections ?? [],
    quiz_questions:      src.quiz_questions ?? [],
    practical_checklist: src.practical_checklist ?? [],
    version:             1,
    is_active:           true,
    cloned_from_id:      src.id,
    created_by:          ctx.authUser.id,
    updated_by:          ctx.authUser.id,
    hospital_id:         ctx.profile.role === 'super_admin' ? src.hospital_id : ctx.profile.hospital_id,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'clone_template',
    entity_type: 'competency_template',
    entity_id: data.id,
    description: `Cloned "${src.title}" → "${parsed.data.newTitle}"`,
    metadata: { cloned_from_id: src.id },
  })

  revalidatePath('/competencies')
  return { success: true, data: { id: data.id } }
}

// ── PUBLISH DRAFT ─────────────────────────────────────────────────────────────

export async function publishTemplate(id: string): Promise<ActionResult> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.competency_templates)
    .select('hospital_id, title, is_draft')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Template not found' }
  if (ctx.profile.role !== 'super_admin' && existing.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Cannot publish templates from a different hospital' }
  }
  if (!existing.is_draft) return { success: false, error: 'Template is already published' }

  const { error } = await ctx.admin.from(T.competency_templates)
    .update({ is_draft: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'publish_template',
    entity_type: 'competency_template',
    entity_id: id,
    description: `Published template "${existing.title}"`,
  })

  revalidatePath('/competencies')
  return { success: true }
}

// ── DEACTIVATE ────────────────────────────────────────────────────────────────

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const ctx = await getEditorCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  if (!['hospital_admin', 'super_admin'].includes(ctx.profile.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { data: existing } = await ctx.admin
    .from(T.competency_templates)
    .select('hospital_id, title')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Template not found' }
  if (ctx.profile.role === 'hospital_admin' && existing.hospital_id !== ctx.profile.hospital_id) {
    return { success: false, error: 'Cannot delete templates from a different hospital' }
  }

  const { count } = await ctx.admin
    .from(T.assessments)
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)
    .in('status', ['not_started', 'in_progress', 'submitted', 'assessor_review', 'head_nurse_review', 'admin_review'])

  if (count && count > 0) {
    return { success: false, error: `Cannot deactivate — ${count} active assessment(s) use this template.` }
  }

  const { error } = await ctx.admin.from(T.competency_templates)
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id: ctx.authUser.id,
    action: 'deactivate_template',
    entity_type: 'competency_template',
    entity_id: id,
    description: `Deactivated template "${existing.title}"`,
  })

  revalidatePath('/competencies')
  return { success: true }
}

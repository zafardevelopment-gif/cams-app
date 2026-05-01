'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/db'
import { RBAC_MODULES, RBAC_ACTIONS, FULL_ACCESS_ROLES } from '@/lib/rbac'
import type { ActionResult } from '@/types'
import type { RoleDefinition, RbacScope } from '@/types'

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getHospitalAdminCaller() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from(T.users)
    .select('role, hospital_id')
    .eq('id', authUser.id)
    .single()

  if (!caller || caller.role !== 'hospital_admin') return null
  if (!caller.hospital_id) return null
  return { authUser, admin, hospitalId: caller.hospital_id as string }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Load all role definitions (system + this hospital's custom) with their permissions. */
export async function getRoleDefinitions(hospitalId: string): Promise<RoleDefinition[]> {
  const admin = createAdminClient()

  const { data: defs } = await admin
    .from(T.role_definitions)
    .select(`*, permissions:${T.role_permissions}(*)`)
    .or(`hospital_id.is.null,hospital_id.eq.${hospitalId}`)
    .order('is_system', { ascending: false })
    .order('display_name')

  return (defs ?? []) as RoleDefinition[]
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createRoleDefinition(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const display_name = (formData.get('display_name') as string | null)?.trim()
  const description  = (formData.get('description')  as string | null)?.trim() || null
  const role_key     = (formData.get('role_key')      as string | null)?.trim()
  const scope        = (formData.get('scope')         as RbacScope | null) ?? 'hospital'

  if (!display_name || display_name.length < 2) return { success: false, error: 'Name is required (min 2 chars)' }
  if (!role_key || !/^[a-z0-9_]+$/.test(role_key)) return { success: false, error: 'Role key must be lowercase letters, numbers, underscores' }

  // Check uniqueness within hospital
  const { data: existing } = await ctx.admin
    .from(T.role_definitions)
    .select('id')
    .eq('hospital_id', ctx.hospitalId)
    .eq('role_key', role_key)
    .maybeSingle()
  if (existing) return { success: false, error: 'A role with this key already exists' }

  const { data, error } = await ctx.admin
    .from(T.role_definitions)
    .insert({ hospital_id: ctx.hospitalId, role_key, display_name, description, is_system: false })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Seed empty permission rows for all module×action combinations
  const rows = RBAC_MODULES.flatMap((m) =>
    RBAC_ACTIONS.map((a) => ({
      role_definition_id: data.id,
      module:  m.key,
      action:  a.key,
      scope,
      granted: false,
    }))
  )
  await ctx.admin.from(T.role_permissions).insert(rows)

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'create_role',
    entity_type: 'role_definition',
    entity_id:   data.id,
    description: `Created role "${display_name}"`,
  })

  revalidatePath('/hospital-admin/roles')
  return { success: true, data: { id: data.id } }
}

// ── Update metadata ───────────────────────────────────────────────────────────

export async function updateRoleDefinition(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.role_definitions)
    .select('is_system, hospital_id, role_key')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Role not found' }
  if (existing.is_system) return { success: false, error: 'System roles cannot be renamed' }
  if (existing.hospital_id !== ctx.hospitalId) return { success: false, error: 'Unauthorized' }

  const display_name = (formData.get('display_name') as string | null)?.trim()
  const description  = (formData.get('description')  as string | null)?.trim() || null
  if (!display_name || display_name.length < 2) return { success: false, error: 'Name is required (min 2 chars)' }

  const { error } = await ctx.admin
    .from(T.role_definitions)
    .update({ display_name, description })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/hospital-admin/roles')
  return { success: true }
}

// ── Save permissions ──────────────────────────────────────────────────────────

export async function saveRolePermissions(
  roleDefinitionId: string,
  permissions: { module: string; action: string; scope: RbacScope; granted: boolean }[],
): Promise<ActionResult> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: roleDef } = await ctx.admin
    .from(T.role_definitions)
    .select('hospital_id, role_key, is_system')
    .eq('id', roleDefinitionId)
    .single()

  if (!roleDef) return { success: false, error: 'Role not found' }
  if (roleDef.hospital_id !== ctx.hospitalId) return { success: false, error: 'Unauthorized' }
  if (FULL_ACCESS_ROLES.includes(roleDef.role_key as typeof FULL_ACCESS_ROLES[number])) {
    return { success: false, error: 'hospital_admin permissions cannot be modified' }
  }

  // Upsert each permission row
  const rows = permissions.map((p) => ({
    role_definition_id: roleDefinitionId,
    module:  p.module,
    action:  p.action,
    scope:   p.scope,
    granted: p.granted,
  }))

  const { error } = await ctx.admin
    .from(T.role_permissions)
    .upsert(rows, { onConflict: 'role_definition_id,module,action' })

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'update_role_permissions',
    entity_type: 'role_definition',
    entity_id:   roleDefinitionId,
    description: `Updated permissions for role "${roleDef.role_key}"`,
  })

  revalidatePath('/hospital-admin/roles')
  return { success: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRoleDefinition(id: string): Promise<ActionResult> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.admin
    .from(T.role_definitions)
    .select('is_system, hospital_id, display_name')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Role not found' }
  if (existing.is_system) return { success: false, error: 'System roles cannot be deleted' }
  if (existing.hospital_id !== ctx.hospitalId) return { success: false, error: 'Unauthorized' }

  const { error } = await ctx.admin.from(T.role_definitions).delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'delete_role',
    entity_type: 'role_definition',
    entity_id:   id,
    description: `Deleted custom role "${existing.display_name}"`,
  })

  revalidatePath('/hospital-admin/roles')
  return { success: true }
}

// ── Assign role to user ───────────────────────────────────────────────────────

export async function assignUserRole(userId: string, roleKey: string): Promise<ActionResult> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  // Verify the user belongs to this hospital
  const { data: targetUser } = await ctx.admin
    .from(T.users)
    .select('hospital_id, full_name, role')
    .eq('id', userId)
    .single()

  if (!targetUser) return { success: false, error: 'User not found' }
  if (targetUser.hospital_id !== ctx.hospitalId) return { success: false, error: 'User is not in your hospital' }

  // Cannot assign super_admin via this action
  if (roleKey === 'super_admin') return { success: false, error: 'Cannot assign super_admin role' }

  const { error } = await ctx.admin
    .from(T.users)
    .update({ role: roleKey })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'assign_role',
    entity_type: 'user',
    entity_id:   userId,
    description: `Changed role of "${targetUser.full_name}" from "${targetUser.role}" to "${roleKey}"`,
  })

  revalidatePath('/staff-directory')
  revalidatePath('/hospital-admin/roles')
  return { success: true }
}

// ── Reset system role permissions to built-in defaults ────────────────────────

/** Default permissions are stored as the system-level definition (hospital_id IS NULL).
 *  Resetting copies those rows into the hospital-specific override, or deletes the
 *  hospital override entirely so the system defaults show through.
 *  Strategy: delete all permission rows for this role_definition_id then re-seed
 *  from the matching system role. */
export async function resetRolePermissions(roleDefinitionId: string): Promise<ActionResult> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const { data: roleDef } = await ctx.admin
    .from(T.role_definitions)
    .select('hospital_id, role_key, display_name')
    .eq('id', roleDefinitionId)
    .single()

  if (!roleDef) return { success: false, error: 'Role not found' }
  if (roleDef.hospital_id !== ctx.hospitalId) return { success: false, error: 'Unauthorized' }
  if (FULL_ACCESS_ROLES.includes(roleDef.role_key as typeof FULL_ACCESS_ROLES[number])) {
    return { success: false, error: 'hospital_admin permissions cannot be modified' }
  }

  // Find the system-level definition for this role_key
  const { data: systemDef } = await ctx.admin
    .from(T.role_definitions)
    .select('id')
    .eq('role_key', roleDef.role_key)
    .is('hospital_id', null)
    .single()

  if (!systemDef) return { success: false, error: 'No system defaults found for this role' }

  // Copy system permissions
  const { data: systemPerms } = await ctx.admin
    .from(T.role_permissions)
    .select('module, action, scope, granted')
    .eq('role_definition_id', systemDef.id)

  if (!systemPerms?.length) return { success: false, error: 'No default permissions to restore' }

  // Delete existing permissions for this hospital role definition
  await ctx.admin.from(T.role_permissions).delete().eq('role_definition_id', roleDefinitionId)

  // Re-insert from system defaults
  const rows = systemPerms.map((p) => ({
    role_definition_id: roleDefinitionId,
    module:  p.module,
    action:  p.action,
    scope:   p.scope,
    granted: p.granted,
  }))
  const { error } = await ctx.admin.from(T.role_permissions).insert(rows)
  if (error) return { success: false, error: error.message }

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'reset_role_permissions',
    entity_type: 'role_definition',
    entity_id:   roleDefinitionId,
    description: `Reset permissions for "${roleDef.display_name}" to system defaults`,
  })

  revalidatePath('/hospital-admin/roles')
  return { success: true }
}

// ── Clone role ────────────────────────────────────────────────────────────────

export async function cloneRoleDefinition(
  sourceId: string,
  newDisplayName: string,
  newRoleKey: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getHospitalAdminCaller()
  if (!ctx) return { success: false, error: 'Unauthorized' }

  const trimmedName = newDisplayName.trim()
  const trimmedKey  = newRoleKey.trim()
  if (!trimmedName || trimmedName.length < 2) return { success: false, error: 'Name is required' }
  if (!/^[a-z0-9_]+$/.test(trimmedKey)) return { success: false, error: 'Role key must be lowercase letters, numbers, underscores' }

  // Load source role + its permissions
  const { data: source } = await ctx.admin
    .from(T.role_definitions)
    .select(`*, permissions:${T.role_permissions}(*)`)
    .eq('id', sourceId)
    .single()

  if (!source) return { success: false, error: 'Source role not found' }

  // Key uniqueness check
  const { data: conflict } = await ctx.admin
    .from(T.role_definitions)
    .select('id')
    .eq('hospital_id', ctx.hospitalId)
    .eq('role_key', trimmedKey)
    .maybeSingle()
  if (conflict) return { success: false, error: 'A role with this key already exists' }

  const { data: newRole, error: createErr } = await ctx.admin
    .from(T.role_definitions)
    .insert({
      hospital_id:  ctx.hospitalId,
      role_key:     trimmedKey,
      display_name: trimmedName,
      description:  source.description ? `Clone of ${source.display_name}` : null,
      is_system:    false,
    })
    .select('id')
    .single()

  if (createErr) return { success: false, error: createErr.message }

  // Copy permissions from source
  const sourcePerms = (source.permissions ?? []) as { module: string; action: string; scope: string; granted: boolean }[]
  if (sourcePerms.length > 0) {
    const rows = sourcePerms.map((p) => ({
      role_definition_id: newRole.id,
      module:  p.module,
      action:  p.action,
      scope:   p.scope,
      granted: p.granted,
    }))
    await ctx.admin.from(T.role_permissions).insert(rows)
  } else {
    // Source had no saved permissions — seed empty rows
    const rows = RBAC_MODULES.flatMap((m) =>
      RBAC_ACTIONS.map((a) => ({ role_definition_id: newRole.id, module: m.key, action: a.key, scope: 'hospital', granted: false }))
    )
    await ctx.admin.from(T.role_permissions).insert(rows)
  }

  await ctx.admin.from(T.activity_logs).insert({
    user_id:     ctx.authUser.id,
    action:      'clone_role',
    entity_type: 'role_definition',
    entity_id:   newRole.id,
    description: `Cloned role "${source.display_name}" → "${trimmedName}"`,
  })

  revalidatePath('/hospital-admin/roles')
  return { success: true, data: { id: newRole.id } }
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import type { UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateRelative(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function daysUntil(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return differenceInDays(d, new Date())
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    super_admin:     'Super Admin',
    hospital_admin:  'Hospital Admin',
    branch_admin:    'Branch Admin',
    department_head: 'Department Head',
    unit_head:       'Unit Head',
    head_nurse:      'Head Nurse',
    educator:        'Educator',
    hr_quality:      'HR / Quality',
    assessor:        'Assessor',
    staff:           'Staff Nurse',
    auditor:         'Auditor',
  }
  return labels[role] ?? role
}

export function getRoleIcon(role: string) {
  const icons: Record<string, string> = {
    super_admin:     '👑',
    hospital_admin:  '🏥',
    branch_admin:    '🏢',
    department_head: '🏬',
    unit_head:       '🔲',
    head_nurse:      '👩‍⚕️',
    educator:        '📖',
    hr_quality:      '📋',
    assessor:        '🩺',
    staff:           '👤',
    auditor:         '🔍',
  }
  return icons[role] ?? '👤'
}

export function getStatusBadgeClass(status: string) {
  const map: Record<string, string> = {
    active: 'badge-green',
    passed: 'badge-green',
    completed: 'badge-green',
    approved: 'badge-green',
    pending: 'badge-amber',
    in_progress: 'badge-blue',
    assessor_review: 'badge-blue',
    head_nurse_review: 'badge-purple',
    admin_review: 'badge-navy',
    submitted: 'badge-teal',
    failed: 'badge-red',
    rejected: 'badge-red',
    suspended: 'badge-red',
    inactive: 'badge-gray',
    expired: 'badge-red',
    expiring_soon: 'badge-amber',
    revoked: 'badge-red',
    overdue: 'badge-red',
    due: 'badge-amber',
    upcoming: 'badge-blue',
    not_started: 'badge-gray',
    needs_renewal: 'badge-amber',
  }
  return map[status] ?? 'badge-gray'
}

export function getStatusLabel(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function getDashboardRoute(role: string) {
  const routes: Record<string, string> = {
    super_admin:     '/super-admin',
    hospital_admin:  '/hospital-admin',
    branch_admin:    '/branch-admin',
    department_head: '/department-head',
    unit_head:       '/unit-head',
    head_nurse:      '/head-nurse',
    educator:        '/educator',
    hr_quality:      '/hr-quality',
    assessor:        '/assessor',
    staff:           '/staff',
    auditor:         '/reports',
  }
  return routes[role] ?? '/staff'
}

// Groups for permission checks — avoids long role arrays inline
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'hospital_admin']
export const MANAGER_ROLES: UserRole[] = ['super_admin', 'hospital_admin', 'branch_admin', 'department_head', 'unit_head', 'head_nurse']
export const APPROVER_ROLES: UserRole[] = ['super_admin', 'hospital_admin', 'branch_admin', 'department_head', 'unit_head', 'head_nurse', 'hr_quality']
export const ASSESSOR_ROLES: UserRole[] = ['assessor', 'educator', 'head_nurse', 'department_head', 'unit_head']

export function getAvatarColor(name: string) {
  const colors = [
    'bg-blue-500',
    'bg-teal-500',
    'bg-purple-500',
    'bg-green-600',
    'bg-amber-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-pink-500',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function generateCertNumber() {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `CAMS-${year}-${rand}`
}

export function getExpiryStatus(expiryDate: string) {
  const days = daysUntil(expiryDate)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring_soon'
  return 'active'
}

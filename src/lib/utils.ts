import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import type { UserRole } from '@/types'

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

export function getRoleBadgeColor(role: string): string {
  const map: Record<string, string> = {
    super_admin:     '#7C3AED', // violet
    hospital_admin:  '#1565C0', // dark blue
    branch_admin:    '#0288D1', // light blue
    department_head: '#2E7D32', // green
    unit_head:       '#388E3C', // lighter green
    head_nurse:      '#AD1457', // pink
    educator:        '#F57F17', // amber
    hr_quality:      '#6A1B9A', // purple
    assessor:        '#00838F', // teal
    staff:           '#546E7A', // blue-gray
    auditor:         '#4E342E', // brown
  }
  return map[role] ?? '#546E7A'
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
    auditor:         '/auditor',
  }
  return routes[role] ?? '/staff'
}

export const APPROVER_ROLES: UserRole[] = ['super_admin', 'hospital_admin', 'branch_admin', 'department_head', 'unit_head', 'head_nurse', 'hr_quality']

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


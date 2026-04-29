// Central table name map — all tables use CAMS_ prefix
// Use with .from(T.x) and inside .select() join strings
export const T = {
  hospitals:              'CAMS_hospitals',
  branches:               'CAMS_branches',
  departments:            'CAMS_departments',
  units:                  'CAMS_units',
  users:                  'CAMS_users',
  registration_requests:  'CAMS_registration_requests',
  competency_templates:   'CAMS_competency_templates',
  assessments:            'CAMS_assessments',
  approvals:              'CAMS_approvals',
  certificates:           'CAMS_certificates',
  renewals:               'CAMS_renewals',
  transfers:              'CAMS_transfers',
  notifications:          'CAMS_notifications',
  activity_logs:          'CAMS_activity_logs',
  settings:               'CAMS_settings',
  email_templates:        'CAMS_email_templates',
  profile_history:        'CAMS_profile_history',
  template_history:       'CAMS_template_history',
  assessment_evidence:    'CAMS_assessment_evidence',
  plans:                  'CAMS_plans',
  coupons:                'CAMS_coupons',
  subscriptions:          'CAMS_subscriptions',
  invoices:               'CAMS_invoices',
  hospital_signups:       'CAMS_hospital_signups',
} as const

// Alias — same values, used in .select() join strings for clarity
export const J = T

export type TableName = typeof T[keyof typeof T]

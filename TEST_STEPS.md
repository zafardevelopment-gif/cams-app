# CAMS — Manual Test Steps

## 1. Hospital Signup (Public)

1. Go to `/login` → click **Register Your Hospital**
2. Fill Step 1 (Hospital Info): name, city, region, license number
3. Fill Step 2 (Admin Contact): contact name, email, phone, password
4. Step 3 (Plan): select a plan, toggle monthly/yearly, apply a coupon code (leave blank too — must not error)
5. Step 4 (Review & Pay): accept terms → **Complete Registration**
6. Expect: success toast, redirect to login

**Edge cases:**
- Leave coupon blank → should succeed (no "coupon_code: Invalid input")
- Wrong email format → inline validation error
- Password < 8 chars → blocked at form level

---

## 2. Login & Role Routing

| Role | Expected redirect after login |
|---|---|
| `super_admin` | `/super-admin` |
| `hospital_admin` | `/hospital-admin` |
| `branch_admin` | `/branch-admin` |
| `staff` | `/staff` |
| `auditor` | `/auditor` |

- Wrong password → toast error
- Unconfirmed email → appropriate message

---

## 3. Staff Directory

### 3a. Filters
1. Go to `/staff-directory`
2. Search by name, email, employee ID — results update instantly
3. Filter by Role dropdown — only matching rows shown
4. Filter by Status — active / pending / inactive
5. **Branch filter**: only visible when hospital has branches enabled
6. **Department filter**: only visible when hospital has departments enabled
7. "Show archived" checkbox → inactive staff appear

### 3b. Add Staff Modal
1. Click **+ Add Staff** → modal opens
2. Select **hospital_admin** → no org fields shown
3. Select **branch_admin** → Branch field appears (required)
4. Select **department_head** → Branch + Department appear
5. Select **head_nurse** or **staff** → Branch + Department + Unit appear
6. Select a branch → Department list filters to relevant departments
7. Select a department → Unit list filters to matching units
8. Change branch → department and unit reset to blank
9. Submit without required dept → toast error "Department is required for this role"
10. Fill all required fields → user created, page reloads

### 3c. Role Badge
- Each role in the table shows a colored pill badge (not plain text)

### 3d. Quick Assign Role
1. Click **Role** button on any active staff row → modal opens
2. Current role shown with colored badge
3. Select new role from grouped dropdown (System Roles / Custom Roles)
4. Click Assign → success toast, row updates

### 3e. Archive / Restore
1. Click **Archive** on a staff row → enter reason → confirm
2. Staff status changes to inactive, row hidden (unless "Show archived" checked)
3. Click **Restore** on archived staff → status → active

### 3f. Reset Password
1. Click **Reset Password** → enter new password (min 8 chars) → confirm
2. Expect success toast

---

## 4. Staff Profile (`/staff-directory/[id]`)

1. Click **View** on any staff row
2. Profile shows role badge with correct color
3. Edit mode: change role via grouped dropdown
4. **Self-protection**: hospital_admin cannot downgrade their own role
5. Save → changes persist on reload
6. License expiry badge: red if expired, amber if ≤ 60 days, gray otherwise

---

## 5. Hospital Settings

### Branches
- `/hospital/branches` — create, rename, deactivate branches
- After disabling Branches in config → Branch filter disappears from Staff Directory, Branch field hidden in Add Staff modal

### Departments & Units
- `/hospital/departments` — create departments
- `/hospital/units` — create units linked to departments
- After disabling Departments in config → Department fields hidden in Staff Directory

---

## 6. Assessments

1. Create a template with quiz + practical checklist sections
2. Assign to a staff member → email notification sent (check console in dev)
3. Staff completes assessment → result recorded
4. Certificate issued on pass → appears in `/certificates`
5. Expiring certificate → shows in `/renewals`

---

## 7. Super Admin

### Subscriptions / Plans
1. Go to `/super-admin` → **Subscriptions** tab
2. **Plans** tab: create a new plan (name, price, billing cycles, staff limit)
3. Edit existing plan inline → save
4. Activate / deactivate plan toggle
5. Delete plan → confirm modal

### Hospital Management
1. List all hospitals, view subscription status
2. Manually activate/suspend a hospital subscription

### Email Configuration
1. Click **⚙️ Settings** from super admin dashboard → `/super-admin/settings`
2. Enter Resend API key → click **Save Configuration**
3. Enter FROM address (e.g. `CAMS <noreply@yourdomain.com>`)
4. Click **📧 Send Test** → check inbox for test email
5. Leave API key blank → system falls back to `RESEND_API_KEY` env var

---

## 8. Reports

1. Go to `/reports`
2. Select report type (Pass/Fail, Competency Matrix, Certificate Expiry, etc.)
3. Apply branch/department filters
4. Data table populates
5. Charts render for pass/fail and branch comparison reports
6. Click **Export Excel** → `.xlsx` downloaded
7. Click **Export PDF** → styled PDF with header and table

---

## 11. Auditor Dashboard

1. Log in as `auditor` role → auto-redirected to `/auditor`
2. KPI cards show: Active Staff, Compliance Rate (color-coded), Active Certs, Expiring Soon, Expired
3. Pass/Fail pie chart and 6-month trend line render
4. Branch compliance and Department compliance bars appear (if hospital has branches/depts)
5. Quick-links panel → clicking a link navigates to the correct report or page
6. "Full Reports" button → `/reports`

---

## 9. Notifications

1. Check bell icon in top nav — unread count badge
2. Click → notification drawer opens
3. Mark as read / mark all read
4. Notification disappears from unread count

---

## 10. Transfers

1. Go to `/transfers` — list of pending/completed transfers
2. Initiate transfer from staff profile
3. Approver sees pending transfer, can approve/reject

---

## Known Flags / Config

| Flag | Location | Effect |
|---|---|---|
| `enableMultiRole = false` | `StaffDirectoryClient.tsx` | Set `true` to enable multi-role checkbox UI |
| `hasBranches` | Hospital config DB | Hides all branch UI when false |
| `hasDepartments` | Hospital config DB | Hides all department/unit UI when false |
| `RESEND_API_KEY` | `.env.local` | If absent, emails log to console only |

---

## Remaining / Incomplete Modules

### HIGH PRIORITY — ALL DONE ✅

#### 1. Transfers — Initiate Transfer UI ✅
- Transfer tab exists in `/staff-directory/[id]` profile page
- `requestTransfer` action in `staff.ts` — inserts into `CAMS_transfers`, notifies staff + admins via in-app notification
- Two-step approval: head nurse → admin

#### 2. Renewals — CSV Export ✅
- Page converted to server + `RenewalsClient.tsx` client component
- Export button builds CSV client-side (Blob/URL, no library) with columns: Staff Name, Job Title, Competency, Category, Certificate #, Due Date, Days Left, Status
- Filename: `renewals-YYYY-MM-DD.csv`

#### 3. Certificates — PDF Download ✅
- `CertificateActions.tsx` uses jsPDF + qrcode (both lazy-imported client-side)
- Generates a styled A4 landscape PDF certificate with QR code pointing to `/verify/[certificateNumber]`
- "Copy Link" button copies verification URL to clipboard

#### 4. Self-Registration Emails ✅
- **New registration**: `auth.ts` `register()` now emails all hospital_admin/branch_admin/hr_quality users at that hospital with a "Review Request →" link. Also creates in-app notifications.
- **On approval**: `users.ts` `approveRegistration()` now sends email to the registering user ("Your account has been approved — Sign In Now →")
- **On rejection**: `users.ts` `rejectRegistration()` now sends email to registering user with the rejection reason
- All emails are fire-and-forget (`.catch(() => {})`) — email failure never blocks the action

#### 5. Billing — Upgrade Request ✅
- `requestPlanUpgrade(planId, billingCycle)` server action added to `billing.ts`
- Notifies all super admins via in-app notification + logs to activity_logs
- `BillingClient.tsx` upgrade panel now has:
  - Monthly/yearly toggle (yearly shows "Save 15%" badge)
  - Clickable plan cards with selection highlight + glow
  - "Request Upgrade" button (disabled until a different plan selected)
  - Submits via `useTransition`, shows success toast, closes panel on success

---

### MEDIUM PRIORITY — ALL DONE ✅

#### 6. Notifications — Email Preferences ✅
- `notifications.ts` email helpers now call `isEmailPrefEnabled(userId, category)` before sending
- `getUserIdByEmail()` resolves user IDs for pref lookups
- All 5 email functions (`emailAssessmentAssignedNotif`, `emailAssessmentResultNotif`, `emailCertExpiryNotif`, `emailSubscriptionExpiryNotif`, `emailLicenseExpiryNotif`) check `email_<category>` pref — skips send if user has disabled it
- Default: enabled when no pref row exists

#### 7. Reports — Export ✅
- Already complete: `ReportsClient.tsx` has both "Export Excel" and "Export PDF" buttons in the page header and again inline on the results card
- `exportExcel()` uses lazy-imported `xlsx` library; `exportPdf()` uses lazy-imported `jspdf` + `jspdf-autotable`
- All 8 report types export correctly

#### 8. Staff Bulk Import — Validation Feedback ✅
- Already complete: `src/app/api/staff/bulk-import/route.ts` returns `{ row, email, status, error }[]` per row
- `BulkImportModal.tsx` shows a results table after import: green "Created" badge or red error badge per row
- Summary line: "X created, Y failed"

#### 9. Competency Templates — Duplication / Clone ✅
- Already complete: `CompetenciesClient.tsx` has "Clone" action per row; `cloneTemplate(id)` action in `competencies.ts`

#### 10. Head Nurse / Department Head Dashboards — Approval Notifications ✅
- `assessments.ts` `evaluatorReview()`: after creating the approval chain, fetches all active users with level-1 approver role in the hospital and sends `emailAssessmentAssignedNotif` (fire-and-forget) to each

#### Super Admin — Email Configuration ✅
- `/super-admin/settings` — new page with Resend API key (masked input + show toggle), FROM address, save button, and send-test-email panel
- `settings.ts` actions: `getEmailConfig`, `saveEmailConfig`, `sendTestEmail` — all scoped to `hospital_id IS NULL` in `CAMS_settings`
- `email.ts` now reads `resend_api_key` + `email_from` from `CAMS_settings` at runtime (DB overrides env vars)
- "⚙️ Settings" link added to super admin dashboard header

---

### LOW PRIORITY — ALL DONE ✅

#### 11. Auditor Role Dashboard ✅
- New page: `/auditor` — dedicated compliance dashboard for auditor role
- KPIs: Active Staff, Compliance Rate (color-coded), Active Certs, Expiring Soon, Expired Certs
- Charts: Pass/Fail pie, 6-month trend, Branch compliance bar, Department compliance bar
- Quick-links panel to key audit reports (Competency Matrix, Pass/Fail, Cert Expiry, Branch Comparison, Renewals, Transfers)
- `getDashboardRoute` updated: auditor now routes to `/auditor` instead of `/reports`
- `getAuditorDashboardData(hospitalId)` action added to `reports.ts`

#### 12. Transfers — Hydration Fix ✅
- `TransfersClient.tsx` line 129: `toLocaleDateString('en-CA')` — already fixed

#### 13. Renewals — "Start Renewal" Button ✅
- `RenewalsClient.tsx`: "Start Renewal" now links to `/competencies/[template_id]/preview`
- Falls back to `/competencies` if `template_id` is null
- `renewals/page.tsx` query updated to include `template_id` in the select
- `Renewal` type updated with `template_id: string | null`

#### 14. Super Admin — Coupon `used_count` ✅
- Already correct: `billing.ts` `approveHospitalSignup()` increments `used_count` when a coupon code is applied during signup approval
- Coupon CRUD (create, toggle active/inactive) exists in `SubscriptionsClient.tsx` Coupons tab

#### 15. Multi-Role Support
- **Status**: Intentionally deferred — requires a DB schema change to `CAMS_users` (role column → array or join table), updates to all `getCaller()` calls across every action file, and RBAC middleware changes
- **Flag**: `enableMultiRole = false` in `StaffDirectoryClient.tsx` — flip to `true` once DB migration is done
- **Effort estimate**: Large (2–3 days)

---

### ALREADY COMPLETE (reference)

| Module | Route | Status |
|---|---|---|
| Hospital Signup | `/signup` | Complete |
| Login + routing | `/login` | Complete |
| Staff Self-Register | `/register` | Complete |
| Forgot Password | `/forgot-password` | Complete |
| Staff Directory | `/staff-directory` | Complete |
| Staff Profile | `/staff-directory/[id]` | Complete |
| Add Staff (role-aware) | modal in staff-directory | Complete |
| Quick Assign Role | modal in staff-directory | Complete |
| Assessments list | `/assessments` | Complete |
| Take Assessment | `/assessments/[id]` | Complete |
| Evaluate Assessment | `/assessments/[id]` | Complete |
| Approval workflow | `/assessments/[id]` | Complete |
| Competency Templates | `/competencies` | Complete |
| Create Template | `/competencies/new` | Complete |
| Edit Template | `/competencies/[id]/edit` | Complete |
| Preview Template | `/competencies/[id]/preview` | Complete |
| Certificates list | `/certificates` | Complete |
| Certificate detail | `/certificates/[id]` | Complete |
| Renewals list + CSV export | `/renewals` | Complete |
| Transfers list + approval | `/transfers` | Complete |
| Reports + charts + export | `/reports` | Complete |
| Notifications inbox | `/notifications` | Complete |
| Notification prefs | `/settings/notifications` | Complete |
| Settings (profile/password) | `/settings` | Complete |
| Hospital config | `/settings` → Hospital tab | Complete |
| Branches CRUD | `/hospital/branches` | Complete |
| Departments CRUD | `/hospital/departments` | Complete |
| Units CRUD | `/hospital/units` | Complete |
| Roles & permissions | `/hospital-admin/roles` | Complete |
| Pending registrations | `/hospital-admin/pending-registrations` | Complete |
| Billing / subscription view | `/billing` | Complete (upgrade stub) |
| Hospital Admin dashboard | `/hospital-admin` | Complete |
| Branch Admin dashboard | `/branch-admin` | Complete |
| Department Head dashboard | `/department-head` | Complete |
| Unit Head dashboard | `/unit-head` | Complete |
| Head Nurse dashboard | `/head-nurse` | Complete |
| Head Nurse approvals | `/head-nurse/approvals` | Complete |
| Educator dashboard | `/educator` | Complete |
| Assessor dashboard | `/assessor` | Complete |
| HR Quality dashboard | `/hr-quality` | Complete |
| Staff dashboard | `/staff` | Complete |
| Auditor dashboard | `/auditor` | Complete |
| Super Admin dashboard | `/super-admin` | Complete |
| Super Admin email config | `/super-admin/settings` | Complete |
| Hospitals management | `/super-admin/hospitals` | Complete |
| Subscriptions + Plans CRUD | `/super-admin/subscriptions` | Complete |
| Bulk CSV import | modal in staff-directory | Complete |

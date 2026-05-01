'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getStaffCompetencyMatrix,
  getPassFailReport,
  getOverdueAssessments,
  getCertificateExpiryReport,
  getTransferHistoryReport,
  getTemplateUsageReport,
  getBranchComparisonReport,
  getDepartmentPerformanceReport,
  getHospitalFilterOptions,
  type ReportFilters,
} from '@/actions/reports'
import {
  PassFailPie,
  ComplianceBar,
  BranchComparisonBar,
  DeptPerformanceBar,
} from '@/components/charts/Charts'

interface FilterOption { id: string; name: string }

const REPORT_TYPES = [
  { id: 'competency_matrix', label: 'Staff Competency Matrix', icon: '📋', desc: 'Full competency status per staff member' },
  { id: 'pass_fail', label: 'Pass / Fail Report', icon: '✅', desc: 'Detailed results of all completed assessments' },
  { id: 'overdue', label: 'Overdue Assessments', icon: '⏰', desc: 'Staff with past-due assessment deadlines' },
  { id: 'cert_expiry', label: 'Certificate Expiry', icon: '🏅', desc: 'Active, expiring, and expired certificates' },
  { id: 'transfers', label: 'Transfer History', icon: '🔄', desc: 'Staff transfer records and status' },
  { id: 'template_usage', label: 'Template Usage', icon: '📚', desc: 'Usage stats per competency template' },
  { id: 'branch_comparison', label: 'Branch Comparison', icon: '🏢', desc: 'Compliance comparison across branches' },
  { id: 'dept_performance', label: 'Department Performance', icon: '🏬', desc: 'Assessment outcomes by department' },
]

type ReportData = unknown[]

export default function ReportsClient({
  hospitalId: initialHospitalId,
  role,
  hospitalName: initialHospitalName,
  branches: initialBranches,
  departments: initialDepartments,
  allHospitals,
}: {
  hospitalId: string
  role: string
  hospitalName: string
  branches: FilterOption[]
  departments: FilterOption[]
  allHospitals: FilterOption[]
}) {
  const isSuperAdmin = role === 'super_admin'
  const [isPending, startTransition] = useTransition()
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData>([])

  // Hospital picker state (super_admin only)
  const [selectedHospitalId, setSelectedHospitalId] = useState(initialHospitalId)
  const [selectedHospitalName, setSelectedHospitalName] = useState(initialHospitalName)
  const [hospitalSearch, setHospitalSearch] = useState(initialHospitalName)
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false)
  const [branches, setBranches] = useState<FilterOption[]>(initialBranches)
  const [departments, setDepartments] = useState<FilterOption[]>(initialDepartments)
  const [isLoadingHospital, setIsLoadingHospital] = useState(false)

  const [filters, setFilters] = useState<ReportFilters>({
    hospitalId: initialHospitalId,
    branchId: '',
    departmentId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  const filteredHospitals = allHospitals.filter((h) =>
    h.name.toLowerCase().includes(hospitalSearch.toLowerCase())
  )

  async function selectHospital(h: FilterOption) {
    setSelectedHospitalId(h.id)
    setSelectedHospitalName(h.name)
    setHospitalSearch(h.name)
    setShowHospitalDropdown(false)
    setFilters((f) => ({ ...f, hospitalId: h.id, branchId: '', departmentId: '' }))
    setActiveReport(null)
    setReportData([])
    setIsLoadingHospital(true)
    const result = await getHospitalFilterOptions(h.id)
    setBranches(result.branches)
    setDepartments(result.departments)
    setIsLoadingHospital(false)
  }

  function setFilter(key: keyof ReportFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined }))
  }

  function activeFilters(): ReportFilters {
    return {
      ...filters,
      hospitalId: selectedHospitalId || undefined,
      branchId: filters.branchId || undefined,
      departmentId: filters.departmentId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }
  }

  function runReport(reportId: string) {
    if (isSuperAdmin && !selectedHospitalId) {
      toast.error('Please select a hospital first')
      return
    }
    setActiveReport(reportId)
    setReportData([])
    startTransition(async () => {
      const f = activeFilters()
      const hid = selectedHospitalId
      let result: { success: boolean; data?: unknown[]; error?: string } | null = null

      if (reportId === 'competency_matrix') result = await getStaffCompetencyMatrix(f)
      else if (reportId === 'pass_fail') result = await getPassFailReport(f)
      else if (reportId === 'overdue') result = await getOverdueAssessments(f)
      else if (reportId === 'cert_expiry') result = await getCertificateExpiryReport(f)
      else if (reportId === 'transfers') result = await getTransferHistoryReport(f)
      else if (reportId === 'template_usage') result = await getTemplateUsageReport(f)
      else if (reportId === 'branch_comparison') {
        result = await getBranchComparisonReport(hid)
      }
      else if (reportId === 'dept_performance') {
        result = await getDepartmentPerformanceReport(hid, f)
      }

      if (!result) return
      if (!result.success) { toast.error(result.error ?? 'Failed to load report'); return }
      setReportData((result.data ?? []) as ReportData)
    })
  }

  async function exportExcel() {
    if (!activeReport || reportData.length === 0) { toast.error('Run a report first'); return }
    try {
      const XLSX = await import('xlsx')
      const reportType = REPORT_TYPES.find((r) => r.id === activeReport)
      const rows = buildExcelRows(activeReport, reportData)
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, reportType?.label?.slice(0, 31) ?? 'Report')
      const filename = `CAMS-${activeReport}-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
      toast.success('Excel exported')
    } catch { toast.error('Export failed') }
  }

  async function exportPdf() {
    if (!activeReport || reportData.length === 0) { toast.error('Run a report first'); return }
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const reportType = REPORT_TYPES.find((r) => r.id === activeReport)

      doc.setFillColor(11, 31, 58)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`CAMS — ${reportType?.label ?? 'Report'}`, 14, 18)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${hospitalName} · Generated ${new Date().toLocaleDateString('en-SA')}`, 14, 30)
      doc.setTextColor(0, 0, 0)

      const { head, body } = buildPdfTable(activeReport, reportData)
      autoTable(doc, {
        startY: 50,
        head: [head],
        body,
        headStyles: { fillColor: [21, 101, 192], textColor: 255, fontSize: 9 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        styles: { fontSize: 8, cellPadding: 3 },
      })

      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text('Generated by CAMS — Competency Assessment Management System', 14, 287)
      doc.save(`CAMS-${activeReport}-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF exported')
    } catch (e) { console.error(e); toast.error('PDF export failed') }
  }

  const currentReport = REPORT_TYPES.find((r) => r.id === activeReport)
  const passCount = activeReport === 'pass_fail' ? (reportData as Array<{ status: string }>).filter((r) => r.status === 'passed').length : 0
  const failCount = activeReport === 'pass_fail' ? (reportData as Array<{ status: string }>).filter((r) => r.status === 'failed').length : 0

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Reports & Analytics</h1>
          <p>{selectedHospitalName ? `${selectedHospitalName} · Real-time data` : 'Select a hospital to begin'}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={exportExcel} disabled={reportData.length === 0 || isPending}>
            📥 Export Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportPdf} disabled={reportData.length === 0 || isPending}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Hospital picker — super_admin only */}
      {isSuperAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', maxWidth: 480, position: 'relative' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>🏥 Select Hospital</label>
              <input
                className="form-input"
                placeholder="Type to search hospitals…"
                value={hospitalSearch}
                onChange={(e) => { setHospitalSearch(e.target.value); setShowHospitalDropdown(true) }}
                onFocus={() => setShowHospitalDropdown(true)}
                onBlur={() => setTimeout(() => setShowHospitalDropdown(false), 180)}
                autoComplete="off"
              />
              {showHospitalDropdown && filteredHospitals.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto', marginTop: 2,
                }}>
                  {filteredHospitals.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                        background: h.id === selectedHospitalId ? '#EBF3FF' : 'white',
                        fontWeight: h.id === selectedHospitalId ? 600 : 400,
                      }}
                      onMouseDown={() => selectHospital(h)}
                    >
                      🏥 {h.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {isLoadingHospital && (
              <div style={{ fontSize: 12, color: 'var(--gray-400)', alignSelf: 'center' }}>Loading hospital data…</div>
            )}
            {selectedHospitalId && !isLoadingHospital && (
              <div style={{ fontSize: 12, color: 'var(--green)', alignSelf: 'center', fontWeight: 600 }}>
                ✓ {selectedHospitalName} selected
              </div>
            )}
            {!selectedHospitalId && (
              <div style={{ fontSize: 12, color: 'var(--gray-400)', alignSelf: 'center' }}>
                Select a hospital to enable reports
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label className="form-label">Date From</label>
              <input type="date" className="form-input" value={filters.dateFrom ?? ''} onChange={(e) => setFilter('dateFrom', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Date To</label>
              <input type="date" className="form-input" value={filters.dateTo ?? ''} onChange={(e) => setFilter('dateTo', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Branch</label>
              <select className="form-input" value={filters.branchId ?? ''} onChange={(e) => setFilter('branchId', e.target.value)} disabled={!selectedHospitalId}>
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Department</label>
              <select className="form-input" value={filters.departmentId ?? ''} onChange={(e) => setFilter('departmentId', e.target.value)} disabled={!selectedHospitalId}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="not_started">Not Started</option>
                <option value="active">Active</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Report type cards */}
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Available Reports
      </h3>
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {REPORT_TYPES.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{
              padding: 18, cursor: 'pointer',
              border: activeReport === r.id ? '2px solid var(--blue)' : '1px solid var(--border)',
              background: activeReport === r.id ? '#EBF3FF' : 'white',
              transition: 'all 0.15s',
            }}
            onClick={() => runReport(r.id)}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{r.icon}</div>
            <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4, fontSize: 13 }}>{r.label}</div>
            <div className="text-muted text-sm">{r.desc}</div>
            {activeReport === r.id && (
              <div style={{ marginTop: 10 }}>
                <span className="badge badge-blue">Active</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Results */}
      {activeReport && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{currentReport?.icon} {currentReport?.label}</div>
              <div className="card-subtitle">{isPending ? 'Loading…' : `${reportData.length} records`}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={exportExcel} disabled={reportData.length === 0}>📥 Excel</button>
              <button className="btn btn-secondary btn-sm" onClick={exportPdf} disabled={reportData.length === 0}>📄 PDF</button>
            </div>
          </div>

          {isPending && (
            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
              Loading report data…
            </div>
          )}

          {!isPending && reportData.length === 0 && (
            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
              No data found for the selected filters
            </div>
          )}

          {!isPending && reportData.length > 0 && (
            <>
              {/* Chart for pass/fail */}
              {activeReport === 'pass_fail' && (
                <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="grid-2" style={{ gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Result Distribution</div>
                      <PassFailPie passed={passCount} failed={failCount} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                      <div className="kpi-card" style={{ padding: '12px 16px' }}>
                        <div className="kpi-label">Total Records</div>
                        <div className="kpi-value" style={{ fontSize: 24 }}>{reportData.length}</div>
                      </div>
                      <div className="kpi-card" style={{ padding: '12px 16px' }}>
                        <div className="kpi-label">Pass Rate</div>
                        <div className="kpi-value" style={{ fontSize: 24, color: 'var(--green)' }}>
                          {reportData.length > 0 ? Math.round((passCount / reportData.length) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart for branch comparison */}
              {activeReport === 'branch_comparison' && (
                <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Branch Compliance Comparison</div>
                  <BranchComparisonBar data={reportData as Array<{ branch: string; compliance: number; staff: number; assessments: number }>} />
                </div>
              )}

              {/* Chart for dept performance */}
              {activeReport === 'dept_performance' && (
                <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Department Assessment Breakdown</div>
                  <div className="grid-2" style={{ gap: 20 }}>
                    <DeptPerformanceBar data={reportData as Array<{ department: string; passed: number; failed: number; compliance: number }>} />
                    <ComplianceBar data={(reportData as Array<{ department: string; compliance: number }>).map((r) => ({ name: r.department.slice(0, 14), compliance: r.compliance }))} label="Compliance %" />
                  </div>
                </div>
              )}

              <div className="card-body p-0">
                <div className="table-wrap">
                  <ReportTable reportId={activeReport} data={reportData} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

// ─── Report Table renderer ────────────────────────────────────────────────────

function ReportTable({ reportId, data }: { reportId: string; data: ReportData }) {
  type Row = Record<string, unknown>
  const rows = data as Row[]

  const getNestedStr = (row: Row, path: string): string => {
    const parts = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let v: any = row
    for (const p of parts) {
      const raw = v?.[p]
      v = Array.isArray(raw) ? raw[0] : raw
    }
    return v != null ? String(v) : '—'
  }

  if (reportId === 'competency_matrix') {
    return (
      <table>
        <thead><tr><th>Staff</th><th>Job Title</th><th>Competency</th><th>Category</th><th>Status</th><th>Score</th><th>Certificate</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{getNestedStr(r, 'staff.full_name')}</td>
              <td className="text-sm text-muted">{getNestedStr(r, 'staff.job_title')}</td>
              <td>{getNestedStr(r, 'template.title')}</td>
              <td><span className="badge badge-gray">{getNestedStr(r, 'template.category')}</span></td>
              <td><StatusBadge status={String(r.status)} /></td>
              <td>{r.overall_score != null ? `${r.overall_score}%` : '—'}</td>
              <td>{getNestedStr(r, 'certificate.status') !== '—' ? <StatusBadge status={getNestedStr(r, 'certificate.status')} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'pass_fail') {
    return (
      <table>
        <thead><tr><th>Staff</th><th>Employee ID</th><th>Competency</th><th>Category</th><th>Result</th><th>Overall</th><th>Knowledge</th><th>Quiz</th><th>Practical</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{getNestedStr(r, 'staff.full_name')}</td>
              <td className="text-sm text-muted">{getNestedStr(r, 'staff.employee_id')}</td>
              <td>{getNestedStr(r, 'template.title')}</td>
              <td><span className="badge badge-gray">{getNestedStr(r, 'template.category')}</span></td>
              <td><StatusBadge status={String(r.status)} /></td>
              <td style={{ fontWeight: 600 }}>{r.overall_score != null ? `${r.overall_score}%` : '—'}</td>
              <td>{r.knowledge_score != null ? `${r.knowledge_score}%` : '—'}</td>
              <td>{r.quiz_score != null ? `${r.quiz_score}%` : '—'}</td>
              <td>{r.practical_score != null ? `${r.practical_score}%` : '—'}</td>
              <td className="text-sm text-muted">{r.completed_at ? new Date(String(r.completed_at)).toLocaleDateString('en-CA') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'overdue') {
    return (
      <table>
        <thead><tr><th>Staff</th><th>Job Title</th><th>Competency</th><th>Category</th><th>Status</th><th>Due Date</th><th>Days Overdue</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const dueDate = r.due_date ? new Date(String(r.due_date)) : null
            const daysOverdue = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : null
            return (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{getNestedStr(r, 'staff.full_name')}</td>
                <td className="text-sm text-muted">{getNestedStr(r, 'staff.job_title')}</td>
                <td>{getNestedStr(r, 'template.title')}</td>
                <td><span className="badge badge-gray">{getNestedStr(r, 'template.category')}</span></td>
                <td><StatusBadge status={String(r.status)} /></td>
                <td className="text-sm">{dueDate ? dueDate.toLocaleDateString('en-CA') : '—'}</td>
                <td style={{ color: 'var(--red)', fontWeight: 600 }}>{daysOverdue != null ? `${daysOverdue}d` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  if (reportId === 'cert_expiry') {
    return (
      <table>
        <thead><tr><th>Staff</th><th>Employee ID</th><th>Competency</th><th>Cert #</th><th>Status</th><th>Issued</th><th>Expires</th><th>Score</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{getNestedStr(r, 'staff.full_name')}</td>
              <td className="text-sm text-muted">{getNestedStr(r, 'staff.employee_id')}</td>
              <td>{getNestedStr(r, 'template.title')}</td>
              <td className="text-sm text-muted">{String(r.certificate_number ?? '—')}</td>
              <td><StatusBadge status={String(r.status)} /></td>
              <td className="text-sm">{r.issued_date ? new Date(String(r.issued_date)).toLocaleDateString('en-CA') : '—'}</td>
              <td className="text-sm" style={{ color: r.status === 'expired' ? 'var(--red)' : r.status === 'expiring_soon' ? '#F57F17' : 'inherit' }}>
                {r.expiry_date ? new Date(String(r.expiry_date)).toLocaleDateString('en-CA') : '—'}
              </td>
              <td>{r.overall_score != null ? `${r.overall_score}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'transfers') {
    return (
      <table>
        <thead><tr><th>Staff</th><th>Employee ID</th><th>From Hospital</th><th>To Hospital</th><th>Status</th><th>Effective Date</th><th>Requested</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{getNestedStr(r, 'staff.full_name')}</td>
              <td className="text-sm text-muted">{getNestedStr(r, 'staff.employee_id')}</td>
              <td className="text-sm">{getNestedStr(r, 'from_hospital.name')}</td>
              <td className="text-sm">{getNestedStr(r, 'to_hospital.name')}</td>
              <td><StatusBadge status={String(r.status)} /></td>
              <td className="text-sm">{r.effective_date ? new Date(String(r.effective_date)).toLocaleDateString('en-CA') : '—'}</td>
              <td className="text-sm text-muted">{new Date(String(r.created_at)).toLocaleDateString('en-CA')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'template_usage') {
    return (
      <table>
        <thead><tr><th>Template</th><th>Category</th><th>Active</th><th>Mandatory</th><th>Total Uses</th><th>Passed</th><th>Failed</th><th>Pass Rate</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{String(r.title ?? '—')}</td>
              <td><span className="badge badge-gray">{String(r.category ?? '—')}</span></td>
              <td>{r.is_active ? <span className="badge badge-green">Yes</span> : <span className="badge badge-red">No</span>}</td>
              <td>{r.is_mandatory ? '✅' : '—'}</td>
              <td style={{ fontWeight: 600 }}>{String(r.totalUsage ?? 0)}</td>
              <td style={{ color: 'var(--green)', fontWeight: 600 }}>{String(r.passed ?? 0)}</td>
              <td style={{ color: 'var(--red)', fontWeight: 600 }}>{String(r.failed ?? 0)}</td>
              <td style={{ fontWeight: 600 }}>{String(r.passRate ?? 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'branch_comparison') {
    return (
      <table>
        <thead><tr><th>Branch</th><th>Staff</th><th>Assessments</th><th>Passed</th><th>Failed</th><th>Compliance %</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{String(r.branch ?? '—')}</td>
              <td>{String(r.staff ?? 0)}</td>
              <td>{String(r.assessments ?? 0)}</td>
              <td style={{ color: 'var(--green)', fontWeight: 600 }}>{String(r.passed ?? 0)}</td>
              <td style={{ color: 'var(--red)', fontWeight: 600 }}>{String(r.failed ?? 0)}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, background: '#eee', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${r.compliance ?? 0}%`, background: Number(r.compliance ?? 0) >= 70 ? 'var(--green)' : 'var(--red)', height: '100%' }} />
                  </div>
                  <span style={{ fontWeight: 600, minWidth: 36 }}>{String(r.compliance ?? 0)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (reportId === 'dept_performance') {
    return (
      <table>
        <thead><tr><th>Department</th><th>Staff</th><th>Assessments</th><th>Passed</th><th>Failed</th><th>Compliance %</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{String(r.department ?? '—')}</td>
              <td>{String(r.staff ?? 0)}</td>
              <td>{String(r.assessments ?? 0)}</td>
              <td style={{ color: 'var(--green)', fontWeight: 600 }}>{String(r.passed ?? 0)}</td>
              <td style={{ color: 'var(--red)', fontWeight: 600 }}>{String(r.failed ?? 0)}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, background: '#eee', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${r.compliance ?? 0}%`, background: Number(r.compliance ?? 0) >= 70 ? 'var(--green)' : 'var(--red)', height: '100%' }} />
                  </div>
                  <span style={{ fontWeight: 600, minWidth: 36 }}>{String(r.compliance ?? 0)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return <div style={{ padding: 20, color: 'var(--gray-400)' }}>Unknown report type</div>
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge-green', active: 'badge-green', approved: 'badge-green', completed: 'badge-green',
  failed: 'badge-red', expired: 'badge-red', rejected: 'badge-red',
  expiring_soon: 'badge-yellow', pending: 'badge-yellow', in_progress: 'badge-yellow', overdue: 'badge-red',
  submitted: 'badge-purple', assessor_review: 'badge-blue', head_nurse_review: 'badge-teal',
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return <span className={`badge ${STATUS_BADGE[status] ?? 'badge-gray'}`}>{label}</span>
}

// ─── Export helpers ───────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>

function buildExcelRows(reportId: string, data: ReportData): unknown[][] {
  const rows = data as AnyRow[]
  const getStr = (row: AnyRow, path: string): string => {
    const parts = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let v: any = row
    for (const p of parts) {
      const raw = v?.[p]
      v = Array.isArray(raw) ? raw[0] : raw
    }
    return v != null ? String(v) : ''
  }

  const configs: Record<string, { headers: string[]; mapper: (r: AnyRow) => unknown[] }> = {
    competency_matrix: {
      headers: ['Staff', 'Job Title', 'Competency', 'Category', 'Status', 'Score', 'Certificate'],
      mapper: (r) => [getStr(r, 'staff.full_name'), getStr(r, 'staff.job_title'), getStr(r, 'template.title'), getStr(r, 'template.category'), r.status, r.overall_score ?? '', getStr(r, 'certificate.status')],
    },
    pass_fail: {
      headers: ['Staff', 'Employee ID', 'Competency', 'Category', 'Result', 'Overall %', 'Knowledge %', 'Quiz %', 'Practical %', 'Date'],
      mapper: (r) => [getStr(r, 'staff.full_name'), getStr(r, 'staff.employee_id'), getStr(r, 'template.title'), getStr(r, 'template.category'), r.status, r.overall_score ?? '', r.knowledge_score ?? '', r.quiz_score ?? '', r.practical_score ?? '', r.completed_at ? new Date(String(r.completed_at)).toLocaleDateString('en-CA') : ''],
    },
    overdue: {
      headers: ['Staff', 'Job Title', 'Competency', 'Category', 'Status', 'Due Date', 'Days Overdue'],
      mapper: (r) => {
        const dueDate = r.due_date ? new Date(String(r.due_date)) : null
        const daysOverdue = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : ''
        return [getStr(r, 'staff.full_name'), getStr(r, 'staff.job_title'), getStr(r, 'template.title'), getStr(r, 'template.category'), r.status, dueDate ? dueDate.toLocaleDateString('en-CA') : '', daysOverdue]
      },
    },
    cert_expiry: {
      headers: ['Staff', 'Employee ID', 'Competency', 'Cert #', 'Status', 'Issued', 'Expires', 'Score'],
      mapper: (r) => [getStr(r, 'staff.full_name'), getStr(r, 'staff.employee_id'), getStr(r, 'template.title'), r.certificate_number ?? '', r.status, r.issued_date ? new Date(String(r.issued_date)).toLocaleDateString('en-CA') : '', r.expiry_date ? new Date(String(r.expiry_date)).toLocaleDateString('en-CA') : '', r.overall_score ?? ''],
    },
    transfers: {
      headers: ['Staff', 'Employee ID', 'From Hospital', 'To Hospital', 'Status', 'Effective Date', 'Requested'],
      mapper: (r) => [getStr(r, 'staff.full_name'), getStr(r, 'staff.employee_id'), getStr(r, 'from_hospital.name'), getStr(r, 'to_hospital.name'), r.status, r.effective_date ? new Date(String(r.effective_date)).toLocaleDateString('en-CA') : '', new Date(String(r.created_at)).toLocaleDateString('en-CA')],
    },
    template_usage: {
      headers: ['Template', 'Category', 'Active', 'Mandatory', 'Total Uses', 'Passed', 'Failed', 'Pass Rate'],
      mapper: (r) => [r.title, r.category, r.is_active ? 'Yes' : 'No', r.is_mandatory ? 'Yes' : 'No', r.totalUsage, r.passed, r.failed, `${r.passRate}%`],
    },
    branch_comparison: {
      headers: ['Branch', 'Staff', 'Assessments', 'Passed', 'Failed', 'Compliance %'],
      mapper: (r) => [r.branch, r.staff, r.assessments, r.passed, r.failed, `${r.compliance}%`],
    },
    dept_performance: {
      headers: ['Department', 'Staff', 'Assessments', 'Passed', 'Failed', 'Compliance %'],
      mapper: (r) => [r.department, r.staff, r.assessments, r.passed, r.failed, `${r.compliance}%`],
    },
  }

  const cfg = configs[reportId]
  if (!cfg) return [['No data']]
  return [cfg.headers, ...rows.map(cfg.mapper)]
}

function buildPdfTable(reportId: string, data: ReportData): { head: string[]; body: string[][] } {
  const rows = buildExcelRows(reportId, data)
  const [head, ...body] = rows
  return { head: head as string[], body: body.map((r) => r.map(String)) }
}

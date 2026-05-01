'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'

interface ImportResult {
  row: number; email: string; status: 'created' | 'error'; error?: string
}

interface Props { onClose: () => void }

const TEMPLATE_HEADERS = 'full_name,email,password,role,job_title,phone,employee_id,nursing_license,license_expiry,hired_date'

const TEMPLATE_ROWS = [
  'Reem Al-Otaibi,reem@hospital.sa,ChangeMe@123,staff,Staff Nurse,+966500000001,EMP-001,SCH-0001,2026-12-31,2020-01-15',
  'Ahmed Al-Rashidi,ahmed.assessor@hospital.sa,ChangeMe@123,assessor,Clinical Assessor,+966500000002,EMP-002,,,,',
  'Sara Mahmoud,sara.educator@hospital.sa,ChangeMe@123,educator,Clinical Educator,+966500000003,EMP-003,,,,',
  'Fatima Hassan,fatima.hn@hospital.sa,ChangeMe@123,head_nurse,Head Nurse,+966500000004,EMP-004,,,,',
  'Khalid Al-Amri,khalid.unit@hospital.sa,ChangeMe@123,unit_head,Unit Head,+966500000005,EMP-005,,,,',
  'Nora Al-Zahrani,nora.dept@hospital.sa,ChangeMe@123,department_head,Department Head,+966500000006,EMP-006,,,,',
  'Omar Al-Ghamdi,omar.hr@hospital.sa,ChangeMe@123,hr_quality,HR & Quality Officer,+966500000007,EMP-007,,,,',
  'Layla Al-Qahtani,layla.branch@hospital.sa,ChangeMe@123,branch_admin,Branch Administrator,+966500000008,EMP-008,,,,',
  'Tariq Al-Dossari,tariq.auditor@hospital.sa,ChangeMe@123,auditor,Compliance Auditor,+966500000009,EMP-009,,,,',
]

export function BulkImportModal({ onClose }: Props) {
  const [csvText, setCsvText] = useState('')
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string)
    reader.readAsText(file)
  }

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    })
  }

  function handleImport() {
    const rows = parseCsv(csvText)
    if (rows.length === 0) { toast.error('No valid rows found. Check CSV format.'); return }
    if (rows.length > 500) { toast.error('Maximum 500 rows per import'); return }

    startTransition(async () => {
      try {
        const res = await fetch('/api/staff/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Import failed'); return }
        setResults(json.results)
        toast.success(`${json.created} created, ${json.failed} failed`)
        if (json.created > 0) window.location.reload()
      } catch {
        toast.error('Network error during import')
      }
    })
  }

  function downloadTemplate() {
    const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'cams_staff_import_template.csv'
    a.click()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>Bulk Import Staff</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!results ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                  📥 Download Template CSV
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  📂 Upload CSV File
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileRead} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>
                Required columns: <code>full_name</code>, <code>email</code>. Optional: <code>password</code> (default: ChangeMe@123), <code>role</code> (default: staff), all other fields.
              </p>
              <div className="form-group">
                <label className="form-label">Paste CSV content</label>
                <textarea
                  className="form-control"
                  rows={10}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`${TEMPLATE_HEADERS}\n${TEMPLATE_ROWS[0]}\n…`}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                {csvText ? `${parseCsv(csvText).length} rows detected` : 'Paste CSV or upload a file above'}
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                Import complete: <strong>{results.filter((r) => r.status === 'created').length} created</strong>,{' '}
                <strong style={{ color: 'var(--red)' }}>{results.filter((r) => r.status === 'error').length} failed</strong>
              </p>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr><th>Row</th><th>Email</th><th>Result</th></tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.email}</td>
                        <td>
                          {r.status === 'created'
                            ? <span className="badge badge-green">Created</span>
                            : <span className="badge badge-red">{r.error}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button className="btn btn-primary" onClick={handleImport} disabled={isPending || !csvText.trim()}>
              {isPending ? 'Importing…' : `Import ${parseCsv(csvText).length || ''} Rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

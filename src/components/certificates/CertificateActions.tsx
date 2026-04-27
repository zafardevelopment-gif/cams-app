'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface CertificateData {
  certificateNumber: string
  staffName: string
  jobTitle: string
  department?: string
  hospital?: string
  templateTitle: string
  templateCategory: string
  overallScore?: number
  issuedDate: string
  expiryDate: string
  validityMonths?: number
  employeeId?: string
}

export default function CertificateActions({ cert }: { cert: CertificateData }) {
  const [downloading, setDownloading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

  async function generateQr() {
    if (qrDataUrl) return
    setLoadingQr(true)
    try {
      const QRCode = (await import('qrcode')).default
      const verifyUrl = `${window.location.origin}/verify/${cert.certificateNumber}`
      const dataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#0B1F3A', light: '#FFFFFF' },
      })
      setQrDataUrl(dataUrl)
    } catch {
      toast.error('Failed to generate QR code')
    } finally {
      setLoadingQr(false)
    }
  }

  async function downloadPdf() {
    setDownloading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const QRCode = (await import('qrcode')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = 297
      const H = 210

      // Background gradient simulation
      doc.setFillColor(11, 31, 58)
      doc.rect(0, 0, W, H, 'F')

      // Decorative circles
      doc.setFillColor(21, 101, 192)
      doc.circle(W - 20, 20, 60, 'F')
      doc.setFillColor(2, 136, 209)
      doc.circle(20, H - 20, 40, 'F')

      // Border
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.5)
      doc.setFillColor(0, 0, 0, 0)
      doc.roundedRect(12, 12, W - 24, H - 24, 4, 4, 'S')

      // Header
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('CAMS — COMPETENCY ASSESSMENT MANAGEMENT SYSTEM', W / 2, 30, { align: 'center' })

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 220, 255)
      doc.text('CERTIFICATE OF COMPETENCY', W / 2, 38, { align: 'center' })

      // Divider
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.3)
      doc.setLineDashPattern([2, 2], 0)
      doc.line(30, 43, W - 30, 43)
      doc.setLineDashPattern([], 0)

      // Main title
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(cert.templateTitle, W / 2, 62, { align: 'center', maxWidth: 200 })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 255)
      doc.text(cert.templateCategory, W / 2, 72, { align: 'center' })

      // "Awarded to" section
      doc.setFontSize(8)
      doc.setTextColor(150, 180, 220)
      doc.text('This certifies that', W / 2, 85, { align: 'center' })

      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(cert.staffName, W / 2, 98, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 255)
      doc.text(`${cert.jobTitle}${cert.department ? ` · ${cert.department}` : ''}${cert.hospital ? ` · ${cert.hospital}` : ''}`, W / 2, 107, { align: 'center' })

      doc.setFontSize(8)
      doc.setTextColor(150, 180, 220)
      doc.text('has successfully demonstrated competency and meets the required standards.', W / 2, 116, { align: 'center' })

      // Info boxes
      const boxY = 128
      const boxes = [
        { label: 'Score', value: cert.overallScore != null ? `${cert.overallScore}%` : 'Pass' },
        { label: 'Issued', value: cert.issuedDate },
        { label: 'Expires', value: cert.expiryDate },
        { label: 'Validity', value: `${cert.validityMonths ?? 12} months` },
      ]
      const boxW = 44
      const startX = W / 2 - (boxes.length * (boxW + 4)) / 2 + 2

      boxes.forEach((box, i) => {
        const bx = startX + i * (boxW + 4)
        doc.setFillColor(255, 255, 255)
        doc.setGState(doc.GState({ opacity: 0.08 }))
        doc.roundedRect(bx, boxY, boxW, 18, 2, 2, 'F')
        doc.setGState(doc.GState({ opacity: 1 }))
        doc.setTextColor(180, 210, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(box.label.toUpperCase(), bx + boxW / 2, boxY + 6, { align: 'center' })
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(box.value, bx + boxW / 2, boxY + 13, { align: 'center' })
      })

      // Footer
      doc.setTextColor(100, 140, 180)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`${cert.certificateNumber} · CAMS Verified`, W / 2, H - 18, { align: 'center' })

      // QR code
      const verifyUrl = `${window.location.origin}/verify/${cert.certificateNumber}`
      const qrData = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 })
      doc.addImage(qrData, 'PNG', W - 42, H - 44, 26, 26)
      doc.setTextColor(100, 140, 180)
      doc.setFontSize(6)
      doc.text('SCAN TO VERIFY', W - 29, H - 15, { align: 'center' })

      doc.save(`Certificate-${cert.certificateNumber}.pdf`)
      toast.success('Certificate downloaded')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={downloadPdf}
          disabled={downloading}
        >
          {downloading ? '⏳ Generating…' : '📄 Download PDF'}
        </button>
        <button
          className="btn btn-teal btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/verify/${cert.certificateNumber}`)
            toast.success('Verification link copied')
          }}
        >
          🔗 Copy Link
        </button>
      </div>

      {/* QR code panel */}
      <div
        className="card"
        style={{ padding: 18, textAlign: 'center', cursor: qrDataUrl ? 'default' : 'pointer' }}
        onClick={!qrDataUrl && !loadingQr ? generateQr : undefined}
      >
        {qrDataUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR Code" style={{ width: 120, height: 120, margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>QR Verification</div>
            <p className="text-muted text-sm">Scan to verify this certificate&apos;s authenticity</p>
          </>
        ) : loadingQr ? (
          <>
            <div style={{ width: 120, height: 120, background: 'var(--gray-100)', borderRadius: 8, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⏳</div>
            <p className="text-muted text-sm">Generating QR code…</p>
          </>
        ) : (
          <>
            <div style={{ width: 120, height: 120, background: 'var(--gray-100)', borderRadius: 8, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🔲</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>QR Verification</div>
            <p className="text-muted text-sm">Click to generate QR code for verification</p>
          </>
        )}
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--gray-500)', marginTop: 8 }}>
          {cert.certificateNumber}
        </div>
      </div>
    </div>
  )
}

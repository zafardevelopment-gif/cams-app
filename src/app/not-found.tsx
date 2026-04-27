import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏥</div>
        <h1 style={{ fontSize: 48, fontWeight: 700, color: '#0B1F3A', marginBottom: 8 }}>404</h1>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0B1F3A', marginBottom: 12 }}>Page Not Found</h2>
        <p style={{ color: '#6B8299', marginBottom: 28, lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>
        <Link
          href="/"
          style={{
            background: 'linear-gradient(135deg,#1565C0,#0288D1)',
            color: 'white', padding: '10px 24px', borderRadius: 8,
            textDecoration: 'none', fontWeight: 600, fontSize: 14,
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

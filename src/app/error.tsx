'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0B1F3A', marginBottom: 12 }}>Something went wrong</h1>
        <p style={{ color: '#6B8299', marginBottom: 24, lineHeight: 1.6 }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          style={{
            background: 'linear-gradient(135deg,#1565C0,#0288D1)',
            color: 'white', padding: '10px 24px', borderRadius: 8,
            border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

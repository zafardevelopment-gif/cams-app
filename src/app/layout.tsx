import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'CAMS — Competency Assessment Management System',
  description: 'Clinical competency tracking, assessment and certification platform for Saudi healthcare.',
  keywords: 'competency assessment, nursing, CBAHI, Saudi Arabia, healthcare',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}

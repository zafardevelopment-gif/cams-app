import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/auth/callback',
  '/verify',
]

const ROLE_ROUTES: Record<string, string> = {
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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called on every request so tokens stay fresh
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Unauthenticated user hitting a protected route → redirect to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.delete('message')
    url.searchParams.delete('error')
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting an auth page → redirect to their dashboard
  if (user && isPublic && pathname !== '/auth/callback' && pathname !== '/verify') {
    const hasMessage = request.nextUrl.searchParams.has('message') || request.nextUrl.searchParams.has('error')
    if (!hasMessage) {
      const role = (user.user_metadata?.role as string) ?? 'staff'
      const url = request.nextUrl.clone()
      url.pathname = ROLE_ROUTES[role] ?? '/staff'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardRoute } from '@/lib/utils'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role ?? 'staff'
      return NextResponse.redirect(`${origin}${getDashboardRoute(role)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

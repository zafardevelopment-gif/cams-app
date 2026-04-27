import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'

export async function GET(request: NextRequest) {
  const hospitalId = request.nextUrl.searchParams.get('hospital_id')
  if (!hospitalId) {
    return NextResponse.json({ branches: [] })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from(T.branches)
    .select('id, name, hospital_id')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ branches: [] }, { status: 500 })
  }

  return NextResponse.json({ branches: data ?? [] })
}

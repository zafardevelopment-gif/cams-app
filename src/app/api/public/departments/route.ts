import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { T } from '@/lib/db'

export async function GET(request: NextRequest) {
  const hospitalId = request.nextUrl.searchParams.get('hospital_id')
  if (!hospitalId) {
    return NextResponse.json({ departments: [] })
  }

  const branchId = request.nextUrl.searchParams.get('branch_id')
  const admin = createAdminClient()

  let query = admin
    .from(T.departments)
    .select('id, name, hospital_id, branch_id')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true)
    .order('name')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ departments: [] }, { status: 500 })
  }

  return NextResponse.json({ departments: data ?? [] })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'knowledge-attachments'
const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

const MIME_TYPE_MAP: Record<string, 'document' | 'video' | 'audio'> = {
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/aac': 'audio',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 100 MB limit' }, { status: 400 })
  }

  const attachmentType = MIME_TYPE_MAP[file.type]
  if (!attachmentType) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const admin = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    url: publicUrl,
    name: file.name,
    type: attachmentType,
    size: file.size,
    path,
  })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await request.json() as { path?: string }
  if (!path) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  // Only allow deleting files the user owns (path starts with their uid)
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

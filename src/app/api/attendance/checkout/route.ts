import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// This route uses service role key so it works even when called via sendBeacon
// (which may not send cookies reliably in all browsers on unload)
export async function POST(request: NextRequest) {
  let attendanceId: string | null = null

  // sendBeacon sends as text/plain or application/json blob
  const contentType = request.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json') || contentType.includes('text/plain') || contentType.includes('application/x-www-form-urlencoded')) {
      const body = await request.json().catch(() => null)
      attendanceId = body?.attendanceId ?? null
    }
  } catch {
    // ignore parse errors
  }

  if (!attendanceId) {
    return NextResponse.json({ error: 'attendanceId required' }, { status: 400 })
  }

  // Use service role for reliability (sendBeacon may drop auth cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('attendance')
    .update({ check_out: now })
    .eq('id', attendanceId)
    .is('check_out', null) // only update if not already checked out

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, checked_out_at: now })
}

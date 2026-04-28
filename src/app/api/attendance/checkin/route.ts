import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // IST date using Intl
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  // Check if already checked in today
  const { data: existing } = await supabase
    .from('attendance')
    .select('id, check_out')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if (existing && !existing.check_out) {
    return NextResponse.json({ id: existing.id, message: 'Already checked in' })
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({ user_id: user.id, date: today })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, message: 'Checked in' }, { status: 201 })
}

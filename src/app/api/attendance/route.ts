import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const userId = searchParams.get('user_id')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  let query = supabase
    .from('attendance')
    .select('*, user:profiles(id, full_name, email)')
    .order('date', { ascending: false })
    .order('check_in', { ascending: false })

  if (profile?.role === 'admin') {
    query = query.eq('date', date)
    if (userId) query = query.eq('user_id', userId)
  } else {
    // Employees can only see their own attendance
    query = query.eq('user_id', user.id).limit(30)
  }

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

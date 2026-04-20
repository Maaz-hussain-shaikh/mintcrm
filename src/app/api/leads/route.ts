import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const assigned_to = searchParams.get('assigned_to')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, assignee:profiles!leads_assigned_to_fkey(id, full_name, email)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (profile?.role === 'employee') {
    query = query.eq('assigned_to', user.id)
  }
  if (status) query = query.eq('status', status)
  if (assigned_to) query = query.eq('assigned_to', assigned_to)
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, phone, email, trip_interest, travel_date, budget, assigned_to, notes } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      email: email || null,
      trip_interest: trip_interest || null,
      travel_date: travel_date || null,
      budget: budget ? parseFloat(budget) : null,
      assigned_to: assigned_to || null,
      notes: notes || null,
      created_by: user.id,
      source: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

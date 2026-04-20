import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const { data: rows } = Papa.parse<any>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty or could not be parsed' }, { status: 400 })
  }

  if (rows.length > 5000) {
    return NextResponse.json({ error: 'Maximum 5,000 rows per upload' }, { status: 400 })
  }

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_active', true)

  const insertErrors: string[] = []
  const validLeads: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    if (!row.name?.trim()) { insertErrors.push(`Row ${rowNum}: Missing name`); continue }
    if (!row.phone?.trim()) { insertErrors.push(`Row ${rowNum}: Missing phone`); continue }

    const budget = row.budget ? parseFloat(String(row.budget).replace(/[^0-9.]/g, '')) : null
    const travelDate = row.travel_date?.trim() || null
    const validDate = travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? travelDate : null

    let assignedTo: string | null = null
    const agentCol = (row.agent_name || row.assigned_to || row.agent || '').trim().toLowerCase()
    if (agentCol && employees) {
      const match = employees.find(
        (e) => e.full_name.toLowerCase() === agentCol || e.email.toLowerCase() === agentCol
      )
      if (match) assignedTo = match.id
      else insertErrors.push(`Row ${rowNum}: Agent "${agentCol}" not found, lead unassigned`)
    }

    validLeads.push({
      name: row.name.trim(),
      phone: row.phone.trim(),
      email: row.email?.trim() || null,
      trip_interest: row.trip_interest?.trim() || null,
      travel_date: validDate,
      budget: budget && !isNaN(budget) ? budget : null,
      status: 'new',
      source: 'csv',
      created_by: user.id,
      assigned_to: assignedTo,
    })
  }

  let inserted = 0
  const BATCH_SIZE = 100

  for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
    const batch = validLeads.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase.from('leads').insert(batch).select('id')
    if (error) insertErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`)
    else inserted += data?.length ?? 0
  }

  return NextResponse.json({ inserted, total: rows.length, skipped: rows.length - validLeads.length, errors: insertErrors })
}

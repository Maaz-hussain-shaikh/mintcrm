import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart3, Users, Phone, TrendingUp } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import EmployeePerformanceTable from '@/components/admin/EmployeePerformanceTable'
import type { EmployeeStats } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // All employees
  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name')

  // All leads
  const { data: leads, count: totalLeads } = await supabase
    .from('leads')
    .select('id, status, assigned_to', { count: 'exact' })
    .limit(5000)

  // All activities
  const { data: activities } = await supabase
    .from('lead_activities')
    .select('user_id, activity_type')
    .limit(10000)

  // Today attendance
  const today = new Date().toISOString().split('T')[0]
  const { data: todayAttendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', today)

  // Build employee stats
  const stats: EmployeeStats[] = (employees ?? []).map(emp => {
    const empLeads = leads?.filter(l => l.assigned_to === emp.id) ?? []
    const empActivities = activities?.filter(a => a.user_id === emp.id) ?? []
    const calls = empActivities.filter(a => a.activity_type === 'call_made').length
    const converted = empLeads.filter(l => l.status === 'converted').length
    const attendanceToday = todayAttendance?.find(a => a.user_id === emp.id) ?? null
    return {
      profile: emp,
      total_leads: empLeads.length,
      calls_made: calls,
      converted,
      attendance_today: attendanceToday,
    }
  })

  const totalCalls = activities?.filter(a => a.activity_type === 'call_made').length ?? 0
  const totalConverted = leads?.filter(l => l.status === 'converted').length ?? 0
  const activeNow = todayAttendance?.filter(a => !a.check_out).length ?? 0

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track team performance and manage your CRM</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads ?? 0} icon={Users} color="green" />
        <StatCard title="Total Calls" value={totalCalls} icon={Phone} color="blue" />
        <StatCard title="Converted" value={totalConverted} icon={TrendingUp} color="orange" />
        <StatCard title="Active Now" value={activeNow} icon={BarChart3} color="purple" subtitle="employees online" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Employee Performance</h2>
        </div>
        <EmployeePerformanceTable stats={stats} />
      </div>
    </div>
  )
}

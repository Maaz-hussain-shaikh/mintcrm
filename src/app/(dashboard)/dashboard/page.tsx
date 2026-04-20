import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, TrendingUp, Phone, Calendar, ArrowRight } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Lead } from '@/types'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  const isAdmin = profile.role === 'admin'

  // Fetch stats
  let leadsQuery = supabase.from('leads').select('id, status, created_at, name, phone, assigned_to', { count: 'exact' })
  if (!isAdmin) leadsQuery = leadsQuery.eq('assigned_to', user.id)
  const { data: allLeads, count: totalLeads } = await leadsQuery.limit(1000)

  const hotLeads = allLeads?.filter(l => l.status === 'hot').length ?? 0
  const converted = allLeads?.filter(l => l.status === 'converted').length ?? 0
  const followUp = allLeads?.filter(l => l.status === 'follow_up').length ?? 0

  // Calls made today
  const today = new Date().toISOString().split('T')[0]
  let actQuery = supabase.from('lead_activities')
    .select('id', { count: 'exact' })
    .eq('activity_type', 'call_made')
    .gte('created_at', today + 'T00:00:00')
  if (!isAdmin) actQuery = actQuery.eq('user_id', user.id)
  const { count: callsToday } = await actQuery

  // Recent leads
  let recentQuery = supabase.from('leads')
    .select('id, name, status, trip_interest, created_at, phone')
    .order('created_at', { ascending: false })
    .limit(5)
  if (!isAdmin) recentQuery = recentQuery.eq('assigned_to', user.id)
  const { data: recentLeads } = await recentQuery

  // Active employees (admin only)
  let activeEmployees = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('attendance')
      .select('id', { count: 'exact' })
      .eq('date', today)
      .is('check_out', null)
    activeEmployees = count ?? 0
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {profile.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">Here's what's happening with your leads today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads ?? 0} icon={Users} color="green" />
        <StatCard title="Hot Leads" value={hotLeads} icon={TrendingUp} color="orange" subtitle="High priority" />
        <StatCard title="Calls Today" value={callsToday ?? 0} icon={Phone} color="blue" />
        <StatCard
          title={isAdmin ? 'Active Now' : 'Follow Ups'}
          value={isAdmin ? activeEmployees : followUp}
          icon={Calendar}
          color="purple"
          subtitle={isAdmin ? 'employees online' : 'pending'}
        />
      </div>

      {/* Lead status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Recent Leads</h2>
            <Link href="/dashboard/leads" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentLeads?.length === 0 && (
              <p className="text-slate-400 text-sm py-4 text-center">No leads yet. Import or add your first lead!</p>
            )}
            {recentLeads?.map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-400">{lead.trip_interest ?? lead.phone} · {format(new Date(lead.created_at), 'MMM d')}</p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Conversion summary */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Lead Pipeline</h2>
          <div className="space-y-3">
            {[
              { label: 'New', value: allLeads?.filter(l => l.status === 'new').length ?? 0, color: 'bg-blue-500' },
              { label: 'Hot', value: hotLeads, color: 'bg-orange-500' },
              { label: 'Follow Up', value: followUp, color: 'bg-purple-500' },
              { label: 'Converted', value: converted, color: 'bg-brand-500' },
              { label: 'Cold', value: allLeads?.filter(l => l.status === 'cold').length ?? 0, color: 'bg-slate-400' },
              { label: 'Not Interested', value: allLeads?.filter(l => l.status === 'not_interested').length ?? 0, color: 'bg-red-400' },
            ].map(item => {
              const pct = totalLeads ? Math.round((item.value / totalLeads) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-medium text-slate-800">{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

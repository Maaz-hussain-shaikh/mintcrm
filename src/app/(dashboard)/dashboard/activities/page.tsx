import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Phone, MessageSquare, RefreshCw, UserCheck, Clock, ArrowRightLeft } from 'lucide-react'

export const revalidate = 0

const activityIcon: Record<string, any> = {
  call_made: Phone,
  note_added: MessageSquare,
  status_change: ArrowRightLeft,
  assigned: UserCheck,
  follow_up_set: Clock,
}

const activityColor: Record<string, string> = {
  call_made: 'bg-blue-50 text-blue-600',
  note_added: 'bg-amber-50 text-amber-600',
  status_change: 'bg-purple-50 text-purple-600',
  assigned: 'bg-brand-50 text-brand-600',
  follow_up_set: 'bg-orange-50 text-orange-600',
}

export default async function ActivitiesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: activities } = await supabase
    .from('lead_activities')
    .select(`
      *,
      user:profiles!lead_activities_user_id_fkey(full_name, email),
      lead:leads!lead_activities_lead_id_fkey(name, phone, status)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const callsToday = activities?.filter(a => {
    const today = new Date().toISOString().split('T')[0]
    return a.activity_type === 'call_made' && a.created_at.startsWith(today)
  }).length ?? 0

  const notesToday = activities?.filter(a => {
    const today = new Date().toISOString().split('T')[0]
    return a.activity_type === 'note_added' && a.created_at.startsWith(today)
  }).length ?? 0

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Activity Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">All team actions across leads</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <Phone className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{callsToday}</p>
            <p className="text-xs text-slate-500">Calls Today</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{notesToday}</p>
            <p className="text-xs text-slate-500">Notes Today</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{activities?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Total Activities</p>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {activities?.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No activities recorded yet</div>
          )}
          {activities?.map((a: any) => {
            const Icon = activityIcon[a.activity_type] ?? RefreshCw
            const colors = activityColor[a.activity_type] ?? 'bg-slate-50 text-slate-500'
            return (
              <div key={a.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${colors}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{a.user?.full_name ?? 'System'}</span>
                      {' '}
                      {a.activity_type === 'call_made' && 'made a call'}
                      {a.activity_type === 'note_added' && `added a note: "${a.note}"`}
                      {a.activity_type === 'status_change' && `changed status from `}
                      {a.activity_type === 'status_change' && (
                        <>
                          <span className="font-medium text-slate-600">{a.old_value}</span>
                          {' → '}
                          <span className="font-medium text-brand-700">{a.new_value}</span>
                        </>
                      )}
                      {a.activity_type === 'assigned' && `assigned lead to ${a.new_value}`}
                      {a.activity_type === 'follow_up_set' && `set follow-up: ${a.new_value}`}
                      {' on '}
                      <span className="font-medium text-slate-700">{a.lead?.name ?? 'a lead'}</span>
                    </p>
                    <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                      {format(new Date(a.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  {a.lead?.phone && (
                    <p className="text-xs text-slate-400 mt-0.5">{a.lead.phone}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatTimeIST, formatDateIST, minutesToHHMM } from '@/lib/dateUtils'
import { Clock, UserCheck } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'

export const revalidate = 0



export default async function AttendancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  // Last 7 days attendance with employee info
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: records } = await supabase
    .from('attendance')
    .select('*, user:profiles(id, full_name, email)')
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false })
    .order('check_in', { ascending: false })

  const todayRecords = records?.filter(r => r.date === today) ?? []
  const activeNow = todayRecords.filter(r => !r.check_out).length
  const checkedInToday = todayRecords.length

  // Group by date for display
  const byDate: Record<string, typeof records> = {}
  for (const rec of records ?? []) {
    if (!byDate[rec.date]) byDate[rec.date] = []
    byDate[rec.date]!.push(rec)
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Live attendance tracking for your team</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Active Now" value={activeNow} icon={UserCheck} color="green" subtitle="employees online" />
        <StatCard title="Checked In Today" value={checkedInToday} icon={Clock} color="blue" />
        <StatCard title="Tracking Days" value={7} icon={Clock} color="slate" subtitle="last 7 days" />
      </div>

      {/* Live section */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-brand-500 rounded-full pulse-dot" />
          <h2 className="font-semibold text-slate-900">Live Now — {new Date().toLocaleDateString('en-IN', {weekday:'long', month:'short', day:'numeric'})}</h2>
        </div>
        {todayRecords.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No check-ins today yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {todayRecords.map((rec: any) => (
              <div key={rec.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-700 text-xs font-bold">
                      {rec.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{rec.user?.full_name}</p>
                    <p className="text-xs text-slate-400">{rec.user?.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">In:</span> {formatTimeIST(rec.check_in)}
                      {rec.check_out && (
                        <> &nbsp;·&nbsp; <span className="font-medium text-slate-700">Out:</span> {formatTimeIST(rec.check_out)}</>
                      )}
                    </div>
                    {rec.total_minutes && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {minutesToHHMM(rec.total_minutes)}
                      </span>
                    )}
                    {!rec.check_out ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-brand-500 rounded-full pulse-dot" /> Online
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Checked out</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History by date */}
      {dates.filter(d => d !== today).map(date => (
        <div key={date} className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-medium text-slate-700 text-sm">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {byDate[date]?.map((rec: any) => (
              <div key={rec.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-slate-600 text-[10px] font-bold">
                      {rec.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{rec.user?.full_name}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>In: <span className="font-medium text-slate-700">{formatTimeIST(rec.check_in)}</span></span>
                  {rec.check_out && <span>Out: <span className="font-medium text-slate-700">{formatTimeIST(rec.check_out)}</span></span>}
                  {rec.total_minutes && (
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      {minutesToHHMM(rec.total_minutes)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

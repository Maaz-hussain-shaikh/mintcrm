'use client'

import { useState, useEffect, useCallback } from 'react'
import { Phone, Star, Clock, TrendingUp, Users, Loader2, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { formatTimeIST, formatDateTimeIST, minutesToHHMM, todayIST } from '@/lib/dateUtils'
import type { Profile } from '@/types'

interface EmployeeReport {
  profile: Profile
  totalAssigned: number
  calledToday: number
  notCalledToday: number
  callbacksDue: number
  rnrCount: number
  converted: number
  hotLeads: number
  bookedLeads: number
  callsTotal: number
  attendance: any
  recentCalls: any[]
}

export default function ReportsPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [reportDate, setReportDate] = useState(todayIST())
  const [reports, setReports] = useState<EmployeeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [summaryStats, setSummaryStats] = useState({ calls: 0, hot: 0, converted: 0, online: 0 })

  const loadReports = useCallback(async (date: string) => {
    if (!profile || profile.role !== 'admin') return
    setLoading(true)

    const dayStart = date + 'T00:00:00+05:30'
    const dayEnd = date + 'T23:59:59+05:30'

    // All employees
    const { data: employees } = await supabase
      .from('profiles').select('*').eq('role', 'employee').eq('is_active', true).order('full_name')

    if (!employees) { setLoading(false); return }

    const built: EmployeeReport[] = await Promise.all(employees.map(async (emp) => {
      const [
        { count: totalAssigned },
        { data: callsToday },
        { count: callbacksDue },
        { count: rnrCount },
        { count: converted },
        { count: hotLeads },
        { count: bookedLeads },
        { data: att },
        { data: recentCalls },
      ] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', emp.id),
        supabase.from('lead_activities')
          .select('lead_id, created_at, lead:leads(name, phone, status)')
          .eq('user_id', emp.id).eq('activity_type', 'call_made')
          .gte('created_at', dayStart).lte('created_at', dayEnd)
          .order('created_at', { ascending: false }),
        supabase.from('leads').select('id', { count: 'exact' })
          .eq('assigned_to', emp.id).eq('status', 'callback')
          .gte('callback_at', date + 'T00:00:00').lte('callback_at', date + 'T23:59:59'),
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', emp.id).eq('status', 'rnr'),
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', emp.id).eq('status', 'converted'),
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', emp.id).eq('status', 'hot'),
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', emp.id).eq('status', 'booked'),
        supabase.from('attendance').select('*').eq('user_id', emp.id).eq('date', date).maybeSingle(),
        supabase.from('lead_activities')
          .select('*, lead:leads(name, phone, status)')
          .eq('user_id', emp.id).eq('activity_type', 'call_made')
          .gte('created_at', dayStart).lte('created_at', dayEnd)
          .order('created_at', { ascending: false }).limit(30),
      ])

      const calledLeadIds = new Set((callsToday ?? []).map((c: any) => c.lead_id))

      return {
        profile: emp,
        totalAssigned: totalAssigned ?? 0,
        calledToday: calledLeadIds.size,
        notCalledToday: (totalAssigned ?? 0) - calledLeadIds.size,
        callbacksDue: callbacksDue ?? 0,
        rnrCount: rnrCount ?? 0,
        converted: converted ?? 0,
        hotLeads: hotLeads ?? 0,
        bookedLeads: bookedLeads ?? 0,
        callsTotal: callsToday?.length ?? 0,
        attendance: att ?? null,
        recentCalls: recentCalls ?? [],
      }
    }))

    setReports(built)
    setSummaryStats({
      calls: built.reduce((a, r) => a + r.callsTotal, 0),
      hot: built.reduce((a, r) => a + r.hotLeads, 0),
      converted: built.reduce((a, r) => a + r.converted, 0),
      online: built.filter(r => r.attendance && !r.attendance.check_out).length,
    })
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { loadReports(reportDate) }, [reportDate])

  if (profile?.role !== 'admin') return (
    <div className="text-center py-20 text-slate-400">Admin access required</div>
  )

  const selectedReport = selectedEmpId ? reports.find(r => r.profile.id === selectedEmpId) : null

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Employee Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">Daily performance report</p>
      </div>

      {/* Date picker */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Report Date:</label>
          <input
            type="date"
            className="input w-auto"
            value={reportDate}
            max={todayIST()}
            onChange={e => {
              setReportDate(e.target.value)
              setSelectedEmpId(null)
            }}
          />
        </div>
        <p className="text-sm text-slate-500">
          {new Date(reportDate + 'T12:00:00').toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-500 ml-auto" />}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: summaryStats.calls, color: 'text-brand-700', bg: 'bg-brand-50' },
          { label: 'Hot Leads', value: summaryStats.hot, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Converted', value: summaryStats.converted, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Online Now', value: summaryStats.online, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`card p-4 text-center ${s.bg}`}>
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Employee table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Employee-wise Report</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-100">
                <tr>
                  <th className="table-head">Employee</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Check-in</th>
                  <th className="table-head">Work Time</th>
                  <th className="table-head">Assigned</th>
                  <th className="table-head">Called Today</th>
                  <th className="table-head">Pending</th>
                  <th className="table-head">Callbacks</th>
                  <th className="table-head">RNR</th>
                  <th className="table-head">Hot</th>
                  <th className="table-head">Converted</th>
                  <th className="table-head">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.map(r => {
                  const isOnline = r.attendance && !r.attendance.check_out
                  const isSelected = selectedEmpId === r.profile.id
                  return (
                    <tr key={r.profile.id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-brand-50/40' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-brand-700 text-xs font-bold">
                              {r.profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{r.profile.full_name}</p>
                            <p className="text-xs text-slate-400 truncate max-w-32">{r.profile.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        {isOnline
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full pulse-dot" /> Online
                            </span>
                          : <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Offline</span>
                        }
                      </td>
                      <td className="table-cell text-xs text-slate-600">
                        {r.attendance ? formatTimeIST(r.attendance.check_in) : '—'}
                      </td>
                      <td className="table-cell text-xs text-slate-600">
                        {minutesToHHMM(r.attendance?.total_minutes)}
                      </td>
                      <td className="table-cell font-semibold text-slate-900">{r.totalAssigned}</td>
                      <td className="table-cell">
                        <span className={`font-semibold ${r.calledToday > 0 ? 'text-brand-700' : 'text-slate-400'}`}>
                          {r.calledToday}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold ${r.notCalledToday > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {Math.max(0, r.notCalledToday)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold ${r.callbacksDue > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
                          {r.callbacksDue}
                        </span>
                      </td>
                      <td className="table-cell font-semibold text-orange-600">{r.rnrCount}</td>
                      <td className="table-cell font-semibold text-rose-600">{r.hotLeads}</td>
                      <td className="table-cell font-semibold text-brand-700">{r.converted}</td>
                      <td className="table-cell">
                        <button
                          onClick={() => setSelectedEmpId(isSelected ? null : r.profile.id)}
                          className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1"
                        >
                          {isSelected ? 'Close' : 'Detail'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedReport && (
        <div className="card overflow-hidden animate-in">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{selectedReport.profile.full_name} — Aaj ki calls</h2>
              <p className="text-xs text-slate-500 mt-0.5">{reportDate} · {selectedReport.callsTotal} total calls</p>
            </div>
            <button onClick={() => setSelectedEmpId(null)} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg">
              Close
            </button>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="text-center">
              <p className="text-xl font-bold text-brand-700">{selectedReport.callsTotal}</p>
              <p className="text-xs text-slate-500">Calls Made</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-600">{selectedReport.hotLeads}</p>
              <p className="text-xs text-slate-500">Hot Leads</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-500">{selectedReport.rnrCount}</p>
              <p className="text-xs text-slate-500">RNR</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-purple-600">{selectedReport.callbacksDue}</p>
              <p className="text-xs text-slate-500">Callbacks Due</p>
            </div>
          </div>

          {/* Call log */}
          <div className="divide-y divide-slate-50">
            {selectedReport.recentCalls.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">Aaj koi call nahi ki</div>
            ) : (
              selectedReport.recentCalls.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.lead?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{c.lead?.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.lead?.status === 'hot' ? 'bg-orange-50 text-orange-700' :
                      c.lead?.status === 'converted' ? 'bg-brand-50 text-brand-700' :
                      c.lead?.status === 'rnr' ? 'bg-red-50 text-red-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>{c.lead?.status ?? '—'}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{formatTimeIST(c.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

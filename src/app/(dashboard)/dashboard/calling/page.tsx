'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Phone, ChevronRight, PhoneCall, CheckCircle, XCircle, Clock,
  MessageSquare, Loader2, CheckCheck, RefreshCw, CalendarClock,
  Flame, Sparkles, PhoneMissed, X, Tag
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Lead, LeadStatus, LeadCategory } from '@/types'
import { formatDateTimeIST, formatDateIST } from '@/lib/dateUtils'
import CategorySelector from '@/components/leads/CategorySelector'
import { isPast } from 'date-fns'

type CallFilter = 'new' | 'callback' | 'rnr' | 'follow_up' | 'hot' | 'all'

const FILTER_CONFIG: { id: CallFilter; label: string; icon: any; activeColor: string; desc: string }[] = [
  { id: 'new',       label: 'Fresh',     icon: Sparkles,     activeColor: 'bg-blue-600 text-white',   desc: 'Naye leads — abhi tak call nahi ki' },
  { id: 'callback',  label: 'Callback',  icon: CalendarClock,activeColor: 'bg-purple-600 text-white', desc: 'Aaj ke callbacks' },
  { id: 'rnr',       label: 'RNR',       icon: PhoneMissed,  activeColor: 'bg-red-500 text-white',    desc: 'Ring No Response — retry' },
  { id: 'follow_up', label: 'Follow Up', icon: Clock,        activeColor: 'bg-orange-500 text-white', desc: 'Scheduled follow-ups' },
  { id: 'hot',       label: 'Hot',       icon: Flame,        activeColor: 'bg-rose-500 text-white',   desc: 'High priority leads' },
  { id: 'all',       label: 'All',       icon: Phone,        activeColor: 'bg-slate-800 text-white',  desc: 'Sab leads (active wale)' },
]

const CALL_OUTCOMES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'hot',            label: '🔥 Hot',           color: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' },
  { status: 'callback',       label: '📅 Callback',       color: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { status: 'rnr',            label: '📵 RNR',            color: 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100' },
  { status: 'follow_up',      label: '🕐 Follow Up',      color: 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { status: 'converted',      label: '✅ Converted',      color: 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100' },
  { status: 'not_interested', label: '🚫 Not Interested', color: 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100' },
  { status: 'cold',           label: '❄️ Cold',           color: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' },
]

interface LoadParams {
  filter: CallFilter
  dateType: 'assigned' | 'called' | 'travel'
  dateVal: string
  categoryId: string
}

export default function CallingPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [activeFilter, setActiveFilter] = useState<CallFilter>('new')
  const [dateType, setDateType] = useState<'assigned' | 'called' | 'travel'>('assigned')
  const [dateVal, setDateVal] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [counts, setCounts] = useState<Record<CallFilter, number>>({ new: 0, callback: 0, rnr: 0, follow_up: 0, hot: 0, all: 0 })

  const [leads, setLeads] = useState<Lead[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [hotNote, setHotNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [callLogged, setCallLogged] = useState<Set<string>>(new Set())
  const [doneCalls, setDoneCalls] = useState<Set<string>>(new Set())

  // Load categories
  useEffect(() => {
    supabase.from('lead_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setCategories(data as any) })
  }, [])

  // Load counts — pass params explicitly to avoid stale closure
  const loadCounts = useCallback(async (params: LoadParams) => {
    if (!profile) return
    const empFilter = (q: any) => profile.role === 'employee' ? q.eq('assigned_to', profile.id) : q
    const applyDate = (q: any) => {
      if (!params.dateVal) return q
      if (params.dateType === 'assigned') return q.eq('assigned_date', params.dateVal)
      if (params.dateType === 'called') return q.eq('last_called_date', params.dateVal)
      if (params.dateType === 'travel') return q.eq('travel_date', params.dateVal)
      return q
    }

    const base = () => {
      let q = supabase.from('leads').select('id', { count: 'exact' })
      q = empFilter(q)
      q = applyDate(q)
      return q
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const [n, cb, rnr, fu, hot, all] = await Promise.all([
      base().eq('status', 'new'),
      base().eq('status', 'callback')
        .gte('callback_at', today + 'T00:00:00')
        .lte('callback_at', today + 'T23:59:59'),
      base().eq('status', 'rnr'),
      base().eq('status', 'follow_up'),
      base().eq('status', 'hot'),
      base().not('status', 'in', '("converted","not_interested")'),
    ])
    setCounts({ new: n.count ?? 0, callback: cb.count ?? 0, rnr: rnr.count ?? 0, follow_up: fu.count ?? 0, hot: hot.count ?? 0, all: all.count ?? 0 })
  }, [profile?.id])

  const loadLeads = useCallback(async (params: LoadParams) => {
    if (!profile) return
    setLoading(true)
    setIdx(0)
    setDoneCalls(new Set())
    setCallLogged(new Set())
    setNote(''); setCallbackAt(''); setFollowUpAt(''); setHotNote('')

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    // Category filter
    let catLeadIds: string[] | null = null
    if (params.categoryId) {
      const { data: mapped } = await supabase.from('lead_category_map').select('lead_id').eq('category_id', params.categoryId)
      catLeadIds = mapped?.map(m => m.lead_id) ?? []
      if (catLeadIds.length === 0) { setLeads([]); setLoading(false); return }
    }

    let q = supabase.from('leads').select('*').order('created_at', { ascending: true }).limit(300)

    if (profile.role === 'employee') q = q.eq('assigned_to', profile.id)

    // Status filter
    if (params.filter === 'new') q = q.eq('status', 'new')
    else if (params.filter === 'callback') q = q.eq('status', 'callback').gte('callback_at', today + 'T00:00:00').lte('callback_at', today + 'T23:59:59')
    else if (params.filter === 'rnr') q = q.eq('status', 'rnr').order('updated_at', { ascending: true })
    else if (params.filter === 'follow_up') q = q.eq('status', 'follow_up').order('follow_up_at', { ascending: true })
    else if (params.filter === 'hot') q = q.eq('status', 'hot')
    else if (params.filter === 'all') q = q.not('status', 'in', '("converted","not_interested")')

    // Date filter
    if (params.dateVal) {
      if (params.dateType === 'assigned') q = q.eq('assigned_date', params.dateVal)
      else if (params.dateType === 'called') q = q.eq('last_called_date', params.dateVal)
      else if (params.dateType === 'travel') q = q.eq('travel_date', params.dateVal)
    }

    if (catLeadIds) q = q.in('id', catLeadIds)

    const { data } = await q
    if (data) setLeads(data as any)
    setLoading(false)
  }, [profile?.id])

  const params: LoadParams = { filter: activeFilter, dateType, dateVal, categoryId }

  useEffect(() => {
    loadCounts(params)
    loadLeads(params)
  }, [activeFilter, dateType, dateVal, categoryId, profile?.id])

  const activeLead = leads[idx] ?? null
  const pendingLeads = leads.filter(l => !doneCalls.has(l.id))
  const allDone = leads.length > 0 && pendingLeads.length === 0

  const logCall = async (lead: Lead) => {
    if (!profile || callLogged.has(lead.id)) return
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile.id, activity_type: 'call_made', note: 'Call from Calling View',
    })
    await supabase.from('leads').update({ last_called_at: new Date().toISOString() }).eq('id', lead.id)
    setCallLogged(prev => new Set([...prev, lead.id]))
    toast.success('Call logged!')
  }

  const updateStatus = async (status: LeadStatus) => {
    if (!activeLead || !profile) return
    setSaving(true)
    const updates: any = { status }
    if (status === 'rnr') updates.rnr_count = (activeLead.rnr_count ?? 0) + 1
    if (status === 'callback' && callbackAt) updates.callback_at = callbackAt
    if (status === 'follow_up' && followUpAt) updates.follow_up_at = followUpAt
    if (hotNote.trim()) updates.hot_note = hotNote.trim()
    await supabase.from('leads').update(updates).eq('id', activeLead.id)
    await supabase.from('lead_activities').insert({
      lead_id: activeLead.id, user_id: profile.id,
      activity_type: 'status_change', old_value: activeLead.status, new_value: status,
      note: hotNote.trim() || null,
    })
    setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, ...updates } : l))
    toast.success(`Status → ${status}`)
    setHotNote('')
    setSaving(false)
    if (['converted', 'not_interested'].includes(status)) setTimeout(() => markDoneAndNext(activeLead.id), 600)
  }

  const saveNote = async () => {
    if (!activeLead || !profile || !note.trim()) return
    setSaving(true)
    await supabase.from('lead_activities').insert({
      lead_id: activeLead.id, user_id: profile.id, activity_type: 'note_added', note: note.trim(),
    })
    await supabase.from('leads').update({ notes: note.trim() }).eq('id', activeLead.id)
    setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, notes: note.trim() } : l))
    setNote('')
    toast.success('Note saved!')
    setSaving(false)
  }

  const markDoneAndNext = (leadId?: string) => {
    const id = leadId ?? activeLead?.id
    if (!id) return
    const newDone = new Set([...doneCalls, id])
    setDoneCalls(newDone)
    setNote(''); setCallbackAt(''); setFollowUpAt(''); setHotNote('')
    const next = leads.findIndex((l, i) => i > idx && !newDone.has(l.id))
    if (next !== -1) setIdx(next)
    else {
      const wrap = leads.findIndex((l, i) => i !== idx && !newDone.has(l.id))
      if (wrap !== -1) setIdx(wrap)
    }
  }

  const reload = () => {
    loadCounts(params)
    loadLeads(params)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Calling View</h1>
          <p className="text-xs text-slate-400 mt-0.5">Filter → Call → Done</p>
        </div>
        <button onClick={reload} className="btn-secondary px-3 py-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {FILTER_CONFIG.map(f => {
          const isActive = activeFilter === f.id
          const count = counts[f.id]
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-center transition-all text-[11px] font-bold ${
                isActive ? f.activeColor + ' border-transparent shadow-md' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'
              }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
              {count > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isActive ? 'bg-white text-slate-900' : 'bg-slate-700 text-white'
                }`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Date + Category filters */}
      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-40">
            <label className="label">Date Filter</label>
            <div className="flex gap-1">
              <select
                className="select text-xs py-2 flex-shrink-0 w-auto"
                value={dateType}
                onChange={e => setDateType(e.target.value as any)}
              >
                <option value="assigned">Assigned</option>
                <option value="called">Last Called</option>
                <option value="travel">Travel Date</option>
              </select>
              <input
                type="date"
                className="input text-xs py-2 flex-1"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
              />
              {dateVal && (
                <button onClick={() => setDateVal('')} className="text-slate-400 hover:text-red-500 px-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {categories.length > 0 && (
            <div className="flex-1 min-w-36">
              <label className="label">Category Filter</label>
              <select className="select text-xs py-2" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {dateVal && (
          <p className="text-xs text-brand-700 font-medium">
            {FILTER_CONFIG.find(f => f.id === activeFilter)?.label} · {dateType}: {dateVal}
          </p>
        )}
      </div>

      {/* Progress */}
      {leads.length > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCalls.size / leads.length) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{pendingLeads.length} remaining</span>
            <span>{doneCalls.size}/{leads.length} done</span>
          </div>
        </div>
      )}

      {/* Lead pills */}
      {leads.length > 0 && !allDone && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
          {leads.map((l, i) => (
            <button key={l.id} onClick={() => { setIdx(i); setNote(''); setCallbackAt(''); setFollowUpAt('') }}
              className={`flex-shrink-0 w-7 h-7 rounded-full text-[11px] font-bold border-2 transition-all ${
                i === idx ? 'bg-brand-600 text-white border-brand-600' :
                doneCalls.has(l.id) ? 'bg-slate-100 text-slate-300 border-slate-100' :
                'bg-white text-slate-600 border-slate-300 hover:border-brand-400'
              }`}>{i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && leads.length === 0 && (
        <div className="card py-16 flex flex-col items-center text-slate-400 gap-3">
          <Phone className="w-14 h-14 opacity-20" />
          <p className="font-medium text-slate-500">
            {dateVal ? `${dateVal} — koi ${activeFilter} lead nahi` : `Koi ${activeFilter} lead nahi`}
          </p>
          <button onClick={reload} className="btn-secondary text-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      )}

      {/* All done */}
      {!loading && allDone && (
        <div className="card p-10 text-center space-y-3 animate-in">
          <p className="text-5xl">🎉</p>
          <p className="font-display text-xl font-bold text-slate-900">Sab done!</p>
          <p className="text-slate-500 text-sm">{leads.length} leads cover ki</p>
          <button onClick={reload} className="btn-primary mx-auto"><RefreshCw className="w-4 h-4" /> Reload</button>
        </div>
      )}

      {/* Lead card */}
      {!loading && activeLead && !allDone && (
        <div className="card p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-bold text-slate-900 leading-tight">{activeLead.name}</h2>
                <StatusBadge status={activeLead.status} />
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">
                {activeLead.destination || activeLead.trip_interest ? <span>✈ {activeLead.destination || activeLead.trip_interest}</span> : null}
                {activeLead.person_count ? <span>👥 {activeLead.person_count} persons</span> : null}
                {activeLead.travel_date ? <span>📅 {formatDateIST(activeLead.travel_date + 'T00:00:00')}</span> : null}
                {activeLead.budget ? <span className="font-semibold text-slate-700">₹{Number(activeLead.budget).toLocaleString('en-IN')}</span> : null}
              </div>
              {(activeLead.rnr_count ?? 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">📵 {activeLead.rnr_count} baar RNR</p>
              )}
            </div>
          </div>

          {/* Call button */}
          <a href={`tel:${activeLead.phone}`} onClick={() => logCall(activeLead)}
            className="flex items-center justify-center gap-3 py-4 bg-brand-600 text-white rounded-xl text-lg font-bold hover:bg-brand-700 active:scale-95 transition-all shadow-md shadow-brand-200 w-full">
            <Phone className="w-6 h-6" />
            {activeLead.phone}
            {callLogged.has(activeLead.id) && <CheckCheck className="w-5 h-5 opacity-80" />}
          </a>
          {!callLogged.has(activeLead.id) && (
            <button onClick={() => logCall(activeLead)} className="w-full text-xs text-slate-400 hover:text-brand-600 transition-colors">
              <PhoneCall className="w-3 h-3 inline mr-1" /> Log karo (dial mat karo)
            </button>
          )}

          {/* Callback time display — always show if set */}
          {activeLead.callback_at && (
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 border ${
              isPast(new Date(activeLead.callback_at))
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-purple-50 border-purple-200 text-purple-700'
            }`}>
              <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">
                  {isPast(new Date(activeLead.callback_at)) ? 'OVERDUE — ' : 'Callback: '}
                </span>
                {formatDateTimeIST(activeLead.callback_at)}
              </div>
            </div>
          )}
          
          {/* Follow-up time display */}
          {activeLead.follow_up_at && activeFilter === 'follow_up' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2 text-orange-700">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Follow-up: </span>
                {formatDateTimeIST(activeLead.follow_up_at)}
                {isPast(new Date(activeLead.follow_up_at)) && <span className="ml-2 bg-orange-200 px-1.5 py-0.5 rounded font-bold">OVERDUE</span>}
              </div>
            </div>
          )}

          {/* Categories */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Category
            </label>
            <CategorySelector leadId={activeLead.id} compact />
          </div>

          {/* Notes */}
          {activeLead.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Pichla Note
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{activeLead.notes}</p>
            </div>
          )}
          {activeLead.hot_note && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Hot Note
              </p>
              <p className="text-sm text-rose-900 whitespace-pre-wrap">{activeLead.hot_note}</p>
            </div>
          )}

          {/* Status buttons */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Call Result</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CALL_OUTCOMES.map(s => (
                <button key={s.status} onClick={() => updateStatus(s.status)}
                  disabled={saving || activeLead.status === s.status}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-40 ${s.color} ${activeLead.status === s.status ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <label className="label">Callback Date/Time</label>
              <input type="datetime-local" className="input text-sm" value={callbackAt} onChange={e => setCallbackAt(e.target.value)} />
              {callbackAt && (
                <button onClick={async () => {
                  if (!activeLead || !profile) return
                  await supabase.from('leads').update({ status: 'callback', callback_at: callbackAt }).eq('id', activeLead.id)
                  await supabase.from('lead_activities').insert({ lead_id: activeLead.id, user_id: profile.id, activity_type: 'status_change', old_value: activeLead.status, new_value: 'callback' })
                  setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, status: 'callback', callback_at: callbackAt } : l))
                  toast.success('Callback set!'); setCallbackAt('')
                  setTimeout(() => markDoneAndNext(activeLead.id), 400)
                }} className="btn-secondary w-full mt-1.5 text-xs justify-center">
                  <CalendarClock className="w-3.5 h-3.5" /> Set Callback
                </button>
              )}
            </div>
            <div>
              <label className="label">Follow-up Time</label>
              <input type="datetime-local" className="input text-sm" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} />
              {followUpAt && (
                <button onClick={async () => {
                  if (!activeLead || !profile) return
                  await supabase.from('leads').update({ status: 'follow_up', follow_up_at: followUpAt }).eq('id', activeLead.id)
                  await supabase.from('lead_activities').insert({ lead_id: activeLead.id, user_id: profile.id, activity_type: 'status_change', old_value: activeLead.status, new_value: 'follow_up' })
                  setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, status: 'follow_up', follow_up_at: followUpAt } : l))
                  toast.success('Follow-up set!'); setFollowUpAt('')
                  setTimeout(() => markDoneAndNext(activeLead.id), 400)
                }} className="btn-secondary w-full mt-1.5 text-xs justify-center">
                  <Clock className="w-3.5 h-3.5" /> Set Follow-up
                </button>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label">Call Note</label>
            <textarea className="input resize-none text-sm" rows={2} value={note}
              onChange={e => setNote(e.target.value)} placeholder="Is call ke baare mein..." />
            {note.trim() && (
              <button onClick={saveNote} disabled={saving} className="btn-secondary w-full mt-1.5 text-xs justify-center">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                Save Note
              </button>
            )}
          </div>

          {/* Hot note */}
          <div>
            <label className="label flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-500" /> Hot Customer Note
            </label>
            <input type="text" className="input text-sm" value={hotNote}
              onChange={e => setHotNote(e.target.value)}
              placeholder="Status update ke saath save hoga..." />
          </div>

          {/* Done */}
          <button onClick={() => markDoneAndNext()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all">
            <ChevronRight className="w-5 h-5" /> Done — Agla Lead
          </button>
        </div>
      )}
    </div>
  )
}

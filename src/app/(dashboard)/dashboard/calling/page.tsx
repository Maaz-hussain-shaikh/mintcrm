'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Phone, ChevronRight, PhoneCall, CheckCircle, XCircle, Clock,
  MessageSquare, Loader2, CheckCheck, RefreshCw, Filter,
  PhoneMissed, CalendarClock, Flame, Sparkles, Star
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Lead, LeadStatus } from '@/types'
import { format, isToday, isPast } from 'date-fns'

// ─── Calling filters ────────────────────────────────────────
type CallFilter = 'new' | 'callback' | 'rnr' | 'follow_up' | 'hot'

const FILTER_CONFIG: {
  id: CallFilter
  label: string
  icon: any
  color: string
  activeColor: string
  desc: string
  emptyMsg: string
}[] = [
  {
    id: 'new',
    label: 'Fresh Leads',
    icon: Sparkles,
    color: 'border-blue-200 text-blue-700 bg-blue-50',
    activeColor: 'bg-blue-600 text-white border-blue-600',
    desc: 'Bilkul naye leads jinhe abhi tak call nahi ki',
    emptyMsg: 'Koi fresh lead nahi hai',
  },
  {
    id: 'callback',
    label: 'Callback',
    icon: CalendarClock,
    color: 'border-purple-200 text-purple-700 bg-purple-50',
    activeColor: 'bg-purple-600 text-white border-purple-600',
    desc: 'Jinhe aaj callback dena hai',
    emptyMsg: 'Aaj koi callback due nahi',
  },
  {
    id: 'rnr',
    label: 'RNR',
    icon: PhoneMissed,
    color: 'border-red-200 text-red-700 bg-red-50',
    activeColor: 'bg-red-500 text-white border-red-500',
    desc: 'Ring No Response — dobara try karo',
    emptyMsg: 'Koi RNR lead nahi hai',
  },
  {
    id: 'follow_up',
    label: 'Follow Up',
    icon: Clock,
    color: 'border-orange-200 text-orange-700 bg-orange-50',
    activeColor: 'bg-orange-500 text-white border-orange-500',
    desc: 'Jinke saath follow up scheduled hai',
    emptyMsg: 'Koi follow-up due nahi',
  },
  {
    id: 'hot',
    label: 'Hot Leads',
    icon: Flame,
    color: 'border-rose-200 text-rose-700 bg-rose-50',
    activeColor: 'bg-rose-500 text-white border-rose-500',
    desc: 'High priority — ye convert ho sakte hain!',
    emptyMsg: 'Koi hot lead nahi hai',
  },
]

// ─── Quick status update options shown DURING a call ────────
const CALL_OUTCOMES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'hot',            label: '🔥 Hot',           color: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' },
  { status: 'callback',       label: '📅 Callback',       color: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { status: 'rnr',            label: '📵 RNR',            color: 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100' },
  { status: 'follow_up',      label: '🕐 Follow Up',      color: 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { status: 'converted',      label: '✅ Converted',      color: 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100' },
  { status: 'not_interested', label: '🚫 Not Interested', color: 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100' },
  { status: 'cold',           label: '❄️ Cold',           color: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' },
]

export default function CallingPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [activeFilter, setActiveFilter] = useState<CallFilter>('new')
  const [leads, setLeads] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<CallFilter, number>>({ new: 0, callback: 0, rnr: 0, follow_up: 0, hot: 0 })
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [callLogged, setCallLogged] = useState<Set<string>>(new Set())
  const [doneCalls, setDoneCalls] = useState<Set<string>>(new Set())
  const [hotNote, setHotNote] = useState('')

  // Load counts for all filters
  const loadCounts = useCallback(async () => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]

    const base = supabase.from('leads').select('id', { count: 'exact' })
    const empFilter = profile.role === 'employee' ? (q: any) => q.eq('assigned_to', profile.id) : (q: any) => q

    const [newC, cbC, rnrC, fuC, hotC] = await Promise.all([
      empFilter(base.eq('status', 'new')),
      empFilter(supabase.from('leads').select('id', { count: 'exact' })
        .eq('status', 'callback')
        .gte('callback_at', today + 'T00:00:00')
        .lte('callback_at', today + 'T23:59:59')),
      empFilter(base.eq('status', 'rnr')),
      empFilter(base.eq('status', 'follow_up')),
      empFilter(base.eq('status', 'hot')),
    ])

    setCounts({
      new: newC.count ?? 0,
      callback: cbC.count ?? 0,
      rnr: rnrC.count ?? 0,
      follow_up: fuC.count ?? 0,
      hot: hotC.count ?? 0,
    })
  }, [profile?.id])

  const loadLeads = useCallback(async (filter: CallFilter) => {
    if (!profile) return
    setLoading(true)
    setIdx(0)
    setDoneCalls(new Set())
    setCallLogged(new Set())
    setNote('')
    setCallbackAt('')
    setFollowUpAt('')

    const today = new Date().toISOString().split('T')[0]

    let q = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)

    if (profile.role === 'employee') q = q.eq('assigned_to', profile.id)

    if (filter === 'new') {
      q = q.eq('status', 'new')
    } else if (filter === 'callback') {
      q = q.eq('status', 'callback')
        .gte('callback_at', today + 'T00:00:00')
        .lte('callback_at', today + 'T23:59:59')
        .order('callback_at', { ascending: true })
    } else if (filter === 'rnr') {
      q = q.eq('status', 'rnr').order('updated_at', { ascending: true })
    } else if (filter === 'follow_up') {
      q = q.eq('status', 'follow_up').order('follow_up_at', { ascending: true })
    } else if (filter === 'hot') {
      q = q.eq('status', 'hot').order('updated_at', { ascending: false })
    }

    const { data } = await q
    if (data) setLeads(data as any)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    loadCounts()
    loadLeads(activeFilter)
  }, [activeFilter, loadCounts, loadLeads])

  const activeLead = leads[idx] ?? null

  const logCall = async (lead: Lead) => {
    if (!profile || callLogged.has(lead.id)) return
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile.id,
      activity_type: 'call_made', note: 'Call from Calling View',
    })
    // Update last_called_at
    await supabase.from('leads').update({ last_called_at: new Date().toISOString() }).eq('id', lead.id)
    setCallLogged(prev => new Set([...prev, lead.id]))
    toast.success('Call logged!')
  }

  const updateStatus = async (status: LeadStatus) => {
    if (!activeLead || !profile) return
    setSaving(true)

    const updates: any = { status }

    // If RNR — increment counter
    if (status === 'rnr') {
      updates.rnr_count = (activeLead.rnr_count ?? 0) + 1
    }

    // If callback — save callback_at
    if (status === 'callback' && callbackAt) {
      updates.callback_at = callbackAt
    }

    // If follow_up — save follow_up_at
    if (status === 'follow_up' && followUpAt) {
      updates.follow_up_at = followUpAt
    }

    // Save hot note if given
    if (hotNote.trim()) {
      updates.hot_note = hotNote.trim()
    }

    await supabase.from('leads').update(updates).eq('id', activeLead.id)
    await supabase.from('lead_activities').insert({
      lead_id: activeLead.id, user_id: profile.id,
      activity_type: 'status_change',
      old_value: activeLead.status, new_value: status,
      note: hotNote.trim() || null,
    })

    setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, ...updates } : l))
    toast.success(`Status → ${status}`)
    setHotNote('')
    setSaving(false)

    // Auto move to next after final statuses
    if (['converted', 'not_interested'].includes(status)) {
      setTimeout(() => markDoneAndNext(activeLead.id), 600)
    }
  }

  const saveNote = async () => {
    if (!activeLead || !profile || !note.trim()) return
    setSaving(true)
    await supabase.from('lead_activities').insert({
      lead_id: activeLead.id, user_id: profile.id,
      activity_type: 'note_added', note: note.trim(),
    })
    await supabase.from('leads').update({ notes: note.trim() }).eq('id', activeLead.id)
    setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, notes: note.trim() } : l))
    setNote('')
    toast.success('Note save ho gaya!')
    setSaving(false)
  }

  const markDoneAndNext = (leadId?: string) => {
    const id = leadId ?? activeLead?.id
    if (!id) return
    const newDone = new Set([...doneCalls, id])
    setDoneCalls(newDone)
    setNote('')
    setCallbackAt('')
    setFollowUpAt('')
    setHotNote('')
    const nextIdx = leads.findIndex((l, i) => i > idx && !newDone.has(l.id))
    if (nextIdx !== -1) setIdx(nextIdx)
    else {
      const fromStart = leads.findIndex((l, i) => i !== idx && !newDone.has(l.id))
      if (fromStart !== -1) setIdx(fromStart)
    }
  }

  const pendingLeads = leads.filter(l => !doneCalls.has(l.id))
  const allDone = leads.length > 0 && pendingLeads.length === 0
  const cfg = FILTER_CONFIG.find(f => f.id === activeFilter)!

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Calling View</h1>
          <p className="text-xs text-slate-400 mt-0.5">Filter chuno → call karo → done karo</p>
        </div>
        <button onClick={() => { loadCounts(); loadLeads(activeFilter) }} className="btn-secondary px-3 py-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ─── FILTER TABS ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-1.5">
        {FILTER_CONFIG.map(f => {
          const isActive = activeFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-center transition-all ${
                isActive ? f.activeColor : f.color + ' hover:opacity-80'
              }`}
            >
              <f.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] font-bold leading-tight">{f.label}</span>
              {counts[f.id] > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow ${
                  isActive ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                }`}>
                  {counts[f.id] > 99 ? '99+' : counts[f.id]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filter description */}
      <div className={`rounded-xl px-4 py-2.5 border ${
        activeFilter === 'new' ? 'bg-blue-50 border-blue-200 text-blue-700' :
        activeFilter === 'callback' ? 'bg-purple-50 border-purple-200 text-purple-700' :
        activeFilter === 'rnr' ? 'bg-red-50 border-red-200 text-red-700' :
        activeFilter === 'follow_up' ? 'bg-orange-50 border-orange-200 text-orange-700' :
        'bg-rose-50 border-rose-200 text-rose-700'
      } flex items-center gap-2 text-sm`}>
        <cfg.icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{cfg.desc}</span>
        {leads.length > 0 && (
          <span className="ml-auto font-bold">{pendingLeads.length} baki</span>
        )}
      </div>

      {/* Progress */}
      {leads.length > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCalls.size / leads.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 text-right">{doneCalls.size}/{leads.length} done</p>
        </div>
      )}

      {/* Lead number pills */}
      {leads.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
          {leads.map((l, i) => (
            <button
              key={l.id}
              onClick={() => { setIdx(i); setNote(''); setCallbackAt(''); setFollowUpAt('') }}
              className={`flex-shrink-0 w-7 h-7 rounded-full text-[11px] font-bold border-2 transition-all ${
                i === idx ? 'bg-brand-600 text-white border-brand-600' :
                doneCalls.has(l.id) ? 'bg-slate-100 text-slate-300 border-slate-100' :
                'bg-white text-slate-600 border-slate-300 hover:border-brand-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && leads.length === 0 && (
        <div className="card py-16 flex flex-col items-center text-slate-400 gap-3">
          <cfg.icon className="w-14 h-14 opacity-20" />
          <p className="font-medium text-slate-500">{cfg.emptyMsg}</p>
          <button onClick={() => loadLeads(activeFilter)} className="btn-secondary text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      {/* All done */}
      {!loading && allDone && (
        <div className="card p-10 text-center space-y-3 animate-in">
          <p className="text-5xl">🎉</p>
          <p className="font-display text-xl font-bold text-slate-900">
            Sab {cfg.label} done!
          </p>
          <p className="text-slate-500 text-sm">{leads.length} leads cover ki</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={() => { loadLeads(activeFilter) }} className="btn-primary">
              <RefreshCw className="w-4 h-4" /> Dobara Load Karo
            </button>
            {activeFilter !== 'callback' && (
              <button onClick={() => setActiveFilter('callback')} className="btn-secondary">
                Callbacks dekho
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── MAIN LEAD CARD ─────────────────────────────── */}
      {!loading && activeLead && !allDone && (
        <div className="card p-4 sm:p-5 space-y-4">

          {/* Lead header */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-bold text-slate-900 leading-tight">
                  {activeLead.name}
                </h2>
                <StatusBadge status={activeLead.status} />
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">
                {activeLead.trip_interest && <span>✈ {activeLead.trip_interest}</span>}
                {activeLead.travel_date && <span>📅 {format(new Date(activeLead.travel_date), 'MMM d, yyyy')}</span>}
                {activeLead.budget && <span className="font-semibold text-slate-700">Rs.{Number(activeLead.budget).toLocaleString('en-IN')}</span>}
              </div>
              {/* RNR count */}
              {(activeLead.rnr_count ?? 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  📵 {activeLead.rnr_count} baar RNR
                  {activeLead.last_called_at && ` · Last: ${format(new Date(activeLead.last_called_at), 'MMM d, h:mm a')}`}
                </p>
              )}
            </div>
          </div>

          {/* Call button */}
          <a
            href={`tel:${activeLead.phone}`}
            onClick={() => logCall(activeLead)}
            className="flex items-center justify-center gap-3 py-4 bg-brand-600 text-white rounded-xl text-lg font-bold hover:bg-brand-700 active:scale-95 transition-all shadow-md shadow-brand-200 w-full"
          >
            <Phone className="w-6 h-6" />
            {activeLead.phone}
            {callLogged.has(activeLead.id) && <CheckCheck className="w-5 h-5 opacity-80" />}
          </a>

          {!callLogged.has(activeLead.id) && (
            <button onClick={() => logCall(activeLead)} className="w-full text-xs text-slate-400 hover:text-brand-600 transition-colors">
              <PhoneCall className="w-3 h-3 inline mr-1" /> Log karo (dial mat karo)
            </button>
          )}

          {/* Callback timing for callback filter */}
          {activeFilter === 'callback' && activeLead.callback_at && (
            <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-xs ${
              isPast(new Date(activeLead.callback_at))
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-purple-50 border border-purple-100 text-purple-700'
            }`}>
              <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
              {isPast(new Date(activeLead.callback_at)) ? 'OVERDUE — ' : ''}
              Callback: {format(new Date(activeLead.callback_at), 'MMM d, h:mm a')}
            </div>
          )}

          {/* Follow-up timing */}
          {activeFilter === 'follow_up' && activeLead.follow_up_at && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-orange-700">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              Follow up: {format(new Date(activeLead.follow_up_at), 'MMM d, h:mm a')}
            </div>
          )}

          {/* Previous notes — ALWAYS VISIBLE */}
          {activeLead.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Pichla Note
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{activeLead.notes}</p>
            </div>
          )}

          {/* Hot note */}
          {activeLead.hot_note && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Hot Note
              </p>
              <p className="text-sm text-rose-900 whitespace-pre-wrap">{activeLead.hot_note}</p>
            </div>
          )}

          {/* ─── CALL OUTCOME BUTTONS ─────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Call result kya raha?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {CALL_OUTCOMES.map(s => (
                <button
                  key={s.status}
                  onClick={() => updateStatus(s.status)}
                  disabled={saving || activeLead.status === s.status}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-40 ${s.color} ${
                    activeLead.status === s.status ? 'ring-2 ring-offset-1 ring-current' : ''
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Callback date input — shows when callback status selected */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Callback Date/Time</label>
                <input type="datetime-local" className="input text-sm" value={callbackAt} onChange={e => setCallbackAt(e.target.value)} />
                {callbackAt && (
                  <button
                    onClick={async () => {
                      if (!activeLead || !profile) return
                      await supabase.from('leads').update({ status: 'callback', callback_at: callbackAt }).eq('id', activeLead.id)
                      await supabase.from('lead_activities').insert({
                        lead_id: activeLead.id, user_id: profile.id,
                        activity_type: 'status_change', old_value: activeLead.status, new_value: 'callback',
                      })
                      setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, status: 'callback', callback_at: callbackAt } : l))
                      toast.success('Callback set!')
                      setCallbackAt('')
                      setTimeout(() => markDoneAndNext(activeLead.id), 400)
                    }}
                    className="btn-secondary w-full mt-1.5 text-xs justify-center"
                  >
                    <CalendarClock className="w-3.5 h-3.5" /> Set Callback
                  </button>
                )}
              </div>
              <div>
                <label className="label">Follow-up Time</label>
                <input type="datetime-local" className="input text-sm" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} />
                {followUpAt && (
                  <button
                    onClick={async () => {
                      if (!activeLead || !profile) return
                      await supabase.from('leads').update({ status: 'follow_up', follow_up_at: followUpAt }).eq('id', activeLead.id)
                      await supabase.from('lead_activities').insert({
                        lead_id: activeLead.id, user_id: profile.id,
                        activity_type: 'status_change', old_value: activeLead.status, new_value: 'follow_up',
                      })
                      setLeads(ls => ls.map(l => l.id === activeLead.id ? { ...l, status: 'follow_up', follow_up_at: followUpAt } : l))
                      toast.success('Follow-up set!')
                      setFollowUpAt('')
                      setTimeout(() => markDoneAndNext(activeLead.id), 400)
                    }}
                    className="btn-secondary w-full mt-1.5 text-xs justify-center"
                  >
                    <Clock className="w-3.5 h-3.5" /> Set Follow-up
                  </button>
                )}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="label">Call Note</label>
              <textarea
                className="input resize-none text-sm"
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Is call ke baare mein kuch note karo..."
              />
              {note.trim() && (
                <button onClick={saveNote} disabled={saving} className="btn-secondary w-full mt-1.5 text-xs justify-center">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  Note Save Karo
                </button>
              )}
            </div>

            {/* Hot customer note */}
            <div>
              <label className="label flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-500" /> Hot Customer Note (optional)
              </label>
              <input
                type="text"
                className="input text-sm"
                value={hotNote}
                onChange={e => setHotNote(e.target.value)}
                placeholder="Kya special hai is customer mein? (status update ke saath save hoga)"
              />
            </div>
          </div>

          {/* Done + Next */}
          <button
            onClick={() => markDoneAndNext()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
            Done — Agla Lead
          </button>
        </div>
      )}
    </div>
  )
}

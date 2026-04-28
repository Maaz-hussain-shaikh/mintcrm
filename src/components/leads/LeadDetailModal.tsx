'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Phone, Mail, MessageSquare, Clock, Loader2, PhoneCall,
  Check, Edit2, CalendarClock, Users, Flame
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import CategorySelector from '@/components/leads/CategorySelector'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { useLeadsStore } from '@/store/leads'
import { formatDateTimeIST, formatDateIST, formatTimeIST } from '@/lib/dateUtils'
import type { Lead, LeadActivity, LeadStatus, Profile } from '@/types'

const STATUS_OPTIONS: LeadStatus[] = [
  'new', 'hot', 'cold', 'not_interested', 'follow_up', 'callback', 'rnr', 'converted', 'booked'
]

interface Props {
  lead: Lead | null
  onClose: () => void
  employees: Profile[]
  isAdmin: boolean
}

export default function LeadDetailModal({ lead, onClose, employees, isAdmin }: Props) {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const { updateLead } = useLeadsStore()

  const [status, setStatus] = useState<LeadStatus>('new')
  const [note, setNote] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [loggingCall, setLoggingCall] = useState(false)
  const [tab, setTab] = useState<'details' | 'activity'>('details')
  const [editMode, setEditMode] = useState(false)

  // Editable fields (both admin and employee)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDestination, setEditDestination] = useState('')
  const [editPersonCount, setEditPersonCount] = useState(1)
  const [editBudget, setEditBudget] = useState('')
  const [editTravelDate, setEditTravelDate] = useState('')

  useEffect(() => {
    if (!lead) return
    setStatus(lead.status)
    setFollowUpAt(lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : '')
    setCallbackAt(lead.callback_at ? lead.callback_at.slice(0, 16) : '')
    setAssignedTo(lead.assigned_to ?? '')
    setEditName(lead.name)
    setEditPhone(lead.phone)
    setEditEmail(lead.email ?? '')
    setEditDestination(lead.destination || lead.trip_interest || '')
    setEditPersonCount(lead.person_count ?? 1)
    setEditBudget(lead.budget ? String(lead.budget) : '')
    setEditTravelDate(lead.travel_date ?? '')
    setEditMode(false)
    setTab('details')
    loadActivities()
  }, [lead?.id])

  const loadActivities = async () => {
    if (!lead) return
    const { data } = await supabase
      .from('lead_activities')
      .select('*, user:profiles(full_name)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setActivities(data as any)
  }

  const handleSave = async () => {
    if (!lead || !profile) return
    setSaving(true)

    const updates: any = {
      status,
      follow_up_at: followUpAt || null,
      callback_at: callbackAt || null,
    }

    // Admin can reassign; employee can reassign to colleagues
    if (isAdmin || profile.role === 'employee') {
      updates.assigned_to = assignedTo || null
    }

    if (editMode) {
      Object.assign(updates, {
        name: editName.trim() || 'Unknown',
        phone: editPhone.trim() || lead.phone,
        email: editEmail.trim() || null,
        destination: editDestination.trim() || null,
        trip_interest: editDestination.trim() || null,
        person_count: editPersonCount,
        budget: editBudget ? parseFloat(editBudget) : null,
        travel_date: editTravelDate || null,
      })
    }

    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)
    if (error) { toast.error(error.message); setSaving(false); return }

    if (status !== lead.status) {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, user_id: profile.id,
        activity_type: 'status_change', old_value: lead.status, new_value: status,
      })
    }
    if (assignedTo !== (lead.assigned_to ?? '')) {
      const emp = employees.find(e => e.id === assignedTo)
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, user_id: profile.id,
        activity_type: 'assigned', new_value: emp?.full_name ?? 'Unassigned',
      })
    }

    updateLead(lead.id, { ...updates, assignee: employees.find(e => e.id === assignedTo) || null })
    toast.success('Lead updated!')
    setEditMode(false)
    setSaving(false)
    loadActivities()
  }

  const handleAddNote = async () => {
    if (!lead || !profile || !note.trim()) return
    setAddingNote(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile.id, activity_type: 'note_added', note: note.trim(),
    })
    await supabase.from('leads').update({ notes: note.trim() }).eq('id', lead.id)
    updateLead(lead.id, { notes: note.trim() })
    setNote('')
    setAddingNote(false)
    loadActivities()
    toast.success('Note added')
  }

  const handleLogCall = async () => {
    if (!lead || !profile) return
    setLoggingCall(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile.id, activity_type: 'call_made', note: 'Manual log',
    })
    await supabase.from('leads').update({ last_called_at: new Date().toISOString() }).eq('id', lead.id)
    setLoggingCall(false)
    loadActivities()
    toast.success('Call logged!')
  }

  if (!lead) return null

  return (
    <Modal open={!!lead} onClose={onClose} title="" width="max-w-2xl">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 -mt-2 mb-4">
        {(['details', 'activity'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <StatusBadge status={lead.status} />
          <button
            onClick={() => setEditMode(!editMode)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
              editMode ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Edit2 className="w-3 h-3" /> {editMode ? 'Editing' : 'Edit'}
          </button>
        </div>
      </div>

      {tab === 'details' && (
        <div className="space-y-4">

          {/* ── Lead Info ── */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
            <div>
              <label className="label">Name</label>
              {editMode
                ? <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                : <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
              }
            </div>
            <div>
              <label className="label">Phone</label>
              {editMode
                ? <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                : <a href={`tel:${lead.phone}`} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" />{lead.phone}
                  </a>
              }
            </div>
            <div>
              <label className="label">Email</label>
              {editMode
                ? <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                : <p className="text-sm text-slate-600">{lead.email || '—'}</p>
              }
            </div>
            <div>
              <label className="label">Destination / Trip</label>
              {editMode
                ? <input className="input" value={editDestination} onChange={e => setEditDestination(e.target.value)} placeholder="Goa, Europe..." />
                : <p className="text-sm text-slate-600">{lead.destination || lead.trip_interest || '—'}</p>
              }
            </div>
            <div>
              <label className="label">Persons</label>
              {editMode
                ? <input className="input" type="number" min={1} value={editPersonCount} onChange={e => setEditPersonCount(Number(e.target.value))} />
                : <p className="text-sm text-slate-700 font-medium">{lead.person_count ?? 1}</p>
              }
            </div>
            <div>
              <label className="label">Budget (₹)</label>
              {editMode
                ? <input className="input" type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} />
                : <p className="text-sm text-slate-700">{lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}</p>
              }
            </div>
            <div>
              <label className="label">Travel Date</label>
              {editMode
                ? <input className="input" type="date" value={editTravelDate} onChange={e => setEditTravelDate(e.target.value)} />
                : <p className="text-sm text-slate-600">{lead.travel_date ? formatDateIST(lead.travel_date + 'T00:00:00') : '—'}</p>
              }
            </div>
            <div>
              <label className="label">Last Called</label>
              <p className="text-sm text-slate-600">{lead.last_called_at ? formatDateTimeIST(lead.last_called_at) : '—'}</p>
            </div>
          </div>

          {/* ── Categories ── */}
          <div>
            <label className="label flex items-center gap-1 mb-2">
              Categories
            </label>
            <CategorySelector leadId={lead.id} />
          </div>

          {/* ── Status ── */}
          <div>
            <label className="label">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    status === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Assign (both admin and employee) ── */}
          <div>
            <label className="label flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {isAdmin ? 'Assign To Employee' : 'Reassign to Colleague'}
            </label>
            <select className="select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.full_name}{e.id === profile?.id ? ' (me)' : ''}
                </option>
              ))}
            </select>
            {!isAdmin && (
              <p className="text-xs text-slate-400 mt-1">Tum apni lead kisi colleague ko transfer kar sakte ho</p>
            )}
          </div>

          {/* ── Follow-up + Callback with time display ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-orange-500" /> Follow-up
              </label>
              <input type="datetime-local" className="input" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} />
              {lead.follow_up_at && !followUpAt && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Set: {formatDateTimeIST(lead.follow_up_at)}
                </p>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5 text-purple-500" /> Callback
              </label>
              <input type="datetime-local" className="input" value={callbackAt} onChange={e => setCallbackAt(e.target.value)} />
              {lead.callback_at && !callbackAt && (
                <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Set: {formatDateTimeIST(lead.callback_at)}
                </p>
              )}
            </div>
          </div>

          {/* ── Hot note display ── */}
          {lead.hot_note && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Hot Note
              </p>
              <p className="text-sm text-rose-900">{lead.hot_note}</p>
            </div>
          )}

          {/* ── Save ── */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
            <button onClick={handleLogCall} className="btn-secondary" disabled={loggingCall}>
              <PhoneCall className="w-4 h-4" />
              {loggingCall ? 'Logging...' : 'Log Call'}
            </button>
          </div>

          {/* ── Notes ── */}
          {lead.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Pichla Note</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <label className="label">Add Note</label>
            <textarea className="input resize-none" rows={2}
              placeholder="Note likho..." value={note} onChange={e => setNote(e.target.value)} />
            <button onClick={handleAddNote} className="btn-secondary mt-2" disabled={!note.trim() || addingNote}>
              <MessageSquare className="w-4 h-4" />
              {addingNote ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </div>
      )}

      {/* ── Activity tab ── */}
      {tab === 'activity' && (
        <div className="space-y-3">
          {activities.length === 0
            ? <p className="text-center text-slate-400 py-8 text-sm">Koi activity nahi</p>
            : activities.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{(a as any).user?.full_name ?? 'System'}</span>
                    {a.activity_type === 'status_change' && <> changed: <span className="text-slate-400">{a.old_value}</span> → <span className="font-semibold text-brand-700">{a.new_value}</span></>}
                    {a.activity_type === 'note_added' && <>: "{a.note}"</>}
                    {a.activity_type === 'call_made' && ' made a call'}
                    {a.activity_type === 'assigned' && <> assigned to <span className="font-semibold">{a.new_value}</span></>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTimeIST(a.created_at)}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </Modal>
  )
}

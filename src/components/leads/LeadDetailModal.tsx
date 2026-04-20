'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Phone, Mail, MapPin, Calendar, DollarSign, MessageSquare, Clock, Loader2, PhoneCall } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { useLeadsStore } from '@/store/leads'
import type { Lead, LeadActivity, LeadStatus, Profile } from '@/types'

const STATUS_OPTIONS: LeadStatus[] = ['new', 'hot', 'cold', 'not_interested', 'follow_up', 'converted']

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
  const [assignedTo, setAssignedTo] = useState('')
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [loggingCall, setLoggingCall] = useState(false)
  const [tab, setTab] = useState<'details' | 'activity'>('details')

  useEffect(() => {
    if (!lead) return
    setStatus(lead.status)
    setFollowUpAt(lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : '')
    setAssignedTo(lead.assigned_to ?? '')
    loadActivities()
  }, [lead])

  const loadActivities = async () => {
    if (!lead) return
    const { data } = await supabase
      .from('lead_activities')
      .select('*, user:profiles(full_name, email)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setActivities(data as any)
  }

  const handleSave = async () => {
    if (!lead || !profile) return
    setSaving(true)

    const updates: Partial<Lead> = {
      status,
      assigned_to: assignedTo || null,
      follow_up_at: followUpAt || null,
    }

    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)
    if (error) { toast.error(error.message); setSaving(false); return }

    // Log status change
    if (status !== lead.status) {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        user_id: profile.id,
        activity_type: 'status_change',
        old_value: lead.status,
        new_value: status,
      })
    }

    // Log assignment change
    if (assignedTo !== (lead.assigned_to ?? '')) {
      const emp = employees.find(e => e.id === assignedTo)
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        user_id: profile.id,
        activity_type: 'assigned',
        new_value: emp?.full_name ?? 'Unassigned',
      })
    }

    updateLead(lead.id, { ...updates, assignee: employees.find(e => e.id === assignedTo) || null })
    toast.success('Lead updated!')
    setSaving(false)
    loadActivities()
  }

  const handleAddNote = async () => {
    if (!lead || !profile || !note.trim()) return
    setAddingNote(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: profile.id,
      activity_type: 'note_added',
      note: note.trim(),
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
      lead_id: lead.id,
      user_id: profile.id,
      activity_type: 'call_made',
      note: 'Call logged',
    })
    setLoggingCall(false)
    loadActivities()
    toast.success('Call logged!')
  }

  if (!lead) return null

  return (
    <Modal open={!!lead} onClose={onClose} title={lead.name} width="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 -mt-2 mb-5">
        {(['details', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <a href={`tel:${lead.phone}`} className="text-slate-700 hover:text-brand-600">{lead.phone}</a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <a href={`mailto:${lead.email}`} className="text-slate-700 hover:text-brand-600 truncate">{lead.email}</a>
              </div>
            )}
            {lead.trip_interest && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{lead.trip_interest}</span>
              </div>
            )}
            {lead.travel_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{format(new Date(lead.travel_date), 'MMM d, yyyy')}</span>
              </div>
            )}
            {lead.budget && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">₹{Number(lead.budget).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    status === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          {isAdmin && (
            <div>
              <label className="label">Assigned To</label>
              <select
                className="select"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Follow-up */}
          <div>
            <label className="label">Follow-up Date &amp; Time</label>
            <input
              type="datetime-local"
              className="input"
              value={followUpAt}
              onChange={e => setFollowUpAt(e.target.value)}
            />
          </div>

          {/* Save */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Changes
            </button>
            <button onClick={handleLogCall} className="btn-secondary" disabled={loggingCall}>
              <PhoneCall className="w-4 h-4" />
              {loggingCall ? 'Logging…' : 'Log Call'}
            </button>
          </div>

          {/* Add Note */}
          <div className="border-t border-slate-100 pt-4">
            <label className="label">Add Note</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Write a note about this lead…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <button
              onClick={handleAddNote}
              className="btn-secondary mt-2"
              disabled={!note.trim() || addingNote}
            >
              <MessageSquare className="w-4 h-4" />
              {addingNote ? 'Adding…' : 'Add Note'}
            </button>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No activity yet</p>
          ) : (
            activities.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{(a as any).user?.full_name ?? 'System'}</span>
                    {a.activity_type === 'status_change' && ` changed status from ${a.old_value} → ${a.new_value}`}
                    {a.activity_type === 'note_added' && ': ' + a.note}
                    {a.activity_type === 'call_made' && ' logged a call'}
                    {a.activity_type === 'assigned' && ` assigned to ${a.new_value}`}
                    {a.activity_type === 'follow_up_set' && ` set follow-up: ${a.new_value}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(a.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  )
}

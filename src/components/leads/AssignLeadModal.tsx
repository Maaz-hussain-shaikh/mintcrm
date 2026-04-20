'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { useLeadsStore } from '@/store/leads'
import type { Lead, Profile } from '@/types'

interface Props {
  lead: Lead | null
  employees: Profile[]
  onClose: () => void
}

export default function AssignLeadModal({ lead, employees, onClose }: Props) {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const { updateLead } = useLeadsStore()
  const [selectedId, setSelectedId] = useState(lead?.assigned_to ?? '')
  const [saving, setSaving] = useState(false)

  const handleAssign = async () => {
    if (!lead || !profile) return
    setSaving(true)
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: selectedId || null })
      .eq('id', lead.id)

    if (error) { toast.error(error.message); setSaving(false); return }

    // Log activity
    const emp = employees.find(e => e.id === selectedId)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: profile.id,
      activity_type: 'assigned',
      new_value: emp?.full_name ?? 'Unassigned',
    })

    updateLead(lead.id, {
      assigned_to: selectedId || null,
      assignee: emp || null,
    })
    toast.success(`Lead assigned to ${emp?.full_name ?? 'nobody'}`)
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={!!lead} onClose={onClose} title={`Assign: ${lead?.name}`} width="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="label">Assign to Employee</label>
          <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleAssign} className="btn-primary flex-1 justify-center" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Assign
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

'use client'

import { useState } from 'react'
import { Loader2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import type { Profile } from '@/types'

interface Props {
  open: boolean
  leadIds: string[]
  employees: Profile[]
  onClose: () => void
  onSuccess: () => void
}

export default function BulkAssignModal({ open, leadIds, employees, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const [selectedEmp, setSelectedEmp] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAssign = async () => {
    if (!selectedEmp || !profile) return
    setSaving(true)

    // Batch update all selected leads
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: selectedEmp })
      .in('id', leadIds)

    if (error) { toast.error(error.message); setSaving(false); return }

    // Log activity for each lead
    const emp = employees.find(e => e.id === selectedEmp)
    const activities = leadIds.map(lead_id => ({
      lead_id,
      user_id: profile.id,
      activity_type: 'assigned' as const,
      new_value: emp?.full_name ?? 'Unknown',
    }))
    await supabase.from('lead_activities').insert(activities)

    toast.success(`${leadIds.length} leads assigned to ${emp?.full_name}!`)
    setSaving(false)
    onSuccess()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${leadIds.length} Leads`} width="max-w-sm">
      <div className="space-y-4">
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
          <p className="text-sm text-brand-700 font-medium">{leadIds.length} leads select ki hain</p>
          <p className="text-xs text-brand-600 mt-0.5">Employee choose karo — selected leads us employee ko assign ho jayengi</p>
        </div>

        <div>
          <label className="label">Employee Choose Karo</label>
          <select className="select" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
            <option value="">-- Employee Select Karo --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAssign}
            className="btn-primary flex-1 justify-center"
            disabled={!selectedEmp || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            {saving ? 'Assigning...' : `Assign ${leadIds.length} Leads`}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

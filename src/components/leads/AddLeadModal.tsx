'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import type { Profile } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  employees: Profile[]
  isAdmin: boolean
}

export default function AddLeadModal({ open, onClose, onSuccess, employees, isAdmin }: Props) {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', trip_interest: '',
    travel_date: '', budget: '', assigned_to: '', notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('leads').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email || null,
      trip_interest: form.trip_interest || null,
      travel_date: form.travel_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
      created_by: profile?.id,
      source: 'manual',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Lead added!')
    setForm({ name: '', phone: '', email: '', trip_interest: '', travel_date: '', budget: '', assigned_to: '', notes: '' })
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Lead">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" required />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" />
          </div>
          <div>
            <label className="label">Trip Interest</label>
            <input className="input" value={form.trip_interest} onChange={e => set('trip_interest', e.target.value)} placeholder="Goa, Manali, Europe…" />
          </div>
          <div>
            <label className="label">Travel Date</label>
            <input className="input" type="date" value={form.travel_date} onChange={e => set('travel_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Budget (₹)</label>
            <input className="input" type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="50000" />
          </div>
          {isAdmin && (
            <div className="col-span-2">
              <label className="label">Assign To</label>
              <select className="select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Initial notes…" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Add Lead
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

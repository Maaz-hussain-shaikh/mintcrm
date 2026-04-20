'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, BookOpen, Plus, Trash2, Phone, Mail, Edit2, Check, X, Loader2, StickyNote } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import type { CustomerList, Lead } from '@/types'
import { format } from 'date-fns'

type Tab = 'hot' | 'booked'

export default function CustomerListsPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [tab, setTab] = useState<Tab>('hot')
  const [items, setItems] = useState<CustomerList[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [searchLeads, setSearchLeads] = useState<Lead[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('customer_lists')
      .select('*, lead:leads(id, name, phone, email, trip_interest, budget, status, travel_date)')
      .eq('user_id', profile.id)
      .eq('list_type', tab)
      .order('created_at', { ascending: false })
    if (data) setItems(data as any)
    setLoading(false)
  }, [profile?.id, tab])

  useEffect(() => { load() }, [load])

  const searchLeadsDB = async (q: string) => {
    if (!q.trim()) { setSearchLeads([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, email, trip_interest, status')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10)
    if (data) setSearchLeads(data as any)
    setSearching(false)
  }

  const addToList = async (lead: Lead, note: string = '') => {
    if (!profile) return
    const { error } = await supabase.from('customer_lists').upsert({
      user_id: profile.id,
      lead_id: lead.id,
      list_type: tab,
      note: note || null,
    }, { onConflict: 'user_id,lead_id,list_type' })
    if (error) { toast.error(error.message); return }
    toast.success(`${lead.name} added to ${tab === 'hot' ? 'Hot' : 'Booked'} list!`)
    setShowAdd(false)
    setSearchQ('')
    setSearchLeads([])
    load()
  }

  const removeFromList = async (id: string, name: string) => {
    await supabase.from('customer_lists').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success(`${name} removed`)
  }

  const saveNote = async (id: string) => {
    await supabase.from('customer_lists').update({ note: noteText }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, note: noteText } : i))
    setEditingNote(null)
    toast.success('Note saved!')
  }

  const startEdit = (item: CustomerList) => {
    setEditingNote(item.id)
    setNoteText(item.note ?? '')
  }

  const tabConfig = {
    hot: {
      label: 'Hot Customers',
      icon: Star,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      desc: 'High potential leads — track karo inhe closely',
      emptyMsg: 'Koi hot customer nahi hai abhi',
    },
    booked: {
      label: 'Booked Customers',
      icon: BookOpen,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      border: 'border-brand-200',
      desc: 'Confirmed bookings — finalized customers ki list',
      emptyMsg: 'Koi booked customer nahi hai abhi',
    },
  }

  const cfg = tabConfig[tab]

  return (
    <div className="space-y-5 animate-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Customer Lists</h1>
          <p className="text-slate-500 text-sm mt-0.5">Apne important customers ko yahan track karo</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['hot', 'booked'] as Tab[]).map(t => {
          const c = tabConfig[t]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <c.icon className={`w-4 h-4 ${tab === t ? c.color : ''}`} />
              {c.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t ? `${c.bg} ${c.color}` : 'bg-slate-200 text-slate-500'
              }`}>
                {tab === t ? items.length : ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab description */}
      <div className={`${cfg.bg} border ${cfg.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
        <cfg.icon className={`w-5 h-5 ${cfg.color} flex-shrink-0`} />
        <p className={`text-sm ${cfg.color} font-medium`}>{cfg.desc}</p>
      </div>

      {/* Add customer panel */}
      {showAdd && (
        <div className="card p-4 space-y-3 border-2 border-brand-200">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-800">Lead search karo</p>
            <button onClick={() => { setShowAdd(false); setSearchQ(''); setSearchLeads([]) }}
              className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              className="input"
              placeholder="Naam ya phone number se search karo..."
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); searchLeadsDB(e.target.value) }}
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
            )}
          </div>
          {searchLeads.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50">
              {searchLeads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{lead.name}</p>
                    <p className="text-xs text-slate-400">{lead.phone} · {lead.trip_interest ?? 'No trip'}</p>
                  </div>
                  <button
                    onClick={() => addToList(lead)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchQ && searchLeads.length === 0 && !searching && (
            <p className="text-sm text-slate-400 text-center py-3">Koi lead nahi mili</p>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-16 flex flex-col items-center text-slate-400">
          <cfg.icon className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium text-slate-500">{cfg.emptyMsg}</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 text-sm">
            <Plus className="w-4 h-4" /> Pehla customer add karo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const lead = item.lead as any
            if (!lead) return null
            return (
              <div key={item.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  {/* Lead info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{lead.name}</h3>
                      {tab === 'hot' && <Star className="w-4 h-4 text-orange-500 fill-orange-400" />}
                      {tab === 'booked' && <BookOpen className="w-4 h-4 text-brand-600" />}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </a>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
                          <Mail className="w-3 h-3" /> {lead.email}
                        </a>
                      )}
                      {lead.trip_interest && (
                        <span className="text-xs text-slate-500">✈ {lead.trip_interest}</span>
                      )}
                      {lead.budget && (
                        <span className="text-xs font-semibold text-slate-700">
                          Rs.{Number(lead.budget).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Added {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Note edit karo"
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFromList(item.id, lead.name)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Note section */}
                {editingNote === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="input resize-none text-sm"
                      rows={2}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Is customer ke baare mein note likho..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveNote(item.id)} className="btn-primary text-xs px-3 py-1.5">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditingNote(null)} className="btn-secondary text-xs px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : item.note ? (
                  <div
                    className={`${cfg.bg} border ${cfg.border} rounded-lg px-3 py-2 cursor-pointer hover:opacity-80`}
                    onClick={() => startEdit(item)}
                  >
                    <p className="text-xs font-semibold text-slate-500 mb-0.5 flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> Note
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.note}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs text-slate-400 hover:text-brand-600 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Note add karo
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

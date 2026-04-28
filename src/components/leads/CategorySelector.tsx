'use client'

import { useState, useEffect, useRef } from 'react'
import { Tag, Plus, X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { LeadCategory } from '@/types'

interface Props {
  leadId: string
  compact?: boolean // for calling view
}

export default function CategorySelector({ leadId, compact = false }: Props) {
  const supabase = createClient()
  const [allCategories, setAllCategories] = useState<LeadCategory[]>([])
  const [assigned, setAssigned] = useState<LeadCategory[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [leadId])

  // Click outside close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: all }, { data: mapped }] = await Promise.all([
      supabase.from('lead_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('lead_category_map')
        .select('*, category:lead_categories(*)')
        .eq('lead_id', leadId),
    ])
    if (all) setAllCategories(all as any)
    if (mapped) setAssigned(mapped.map((m: any) => m.category).filter(Boolean) as any)
    setLoading(false)
  }

  const toggleCategory = async (cat: LeadCategory) => {
    const isAssigned = assigned.some(a => a.id === cat.id)
    if (isAssigned) {
      const { error } = await supabase.from('lead_category_map')
        .delete().eq('lead_id', leadId).eq('category_id', cat.id)
      if (error) { toast.error(error.message); return }
      setAssigned(prev => prev.filter(a => a.id !== cat.id))
      toast.success(`"${cat.name}" hataya`)
    } else {
      const { error } = await supabase.from('lead_category_map').insert({
        lead_id: leadId, category_id: cat.id,
      })
      if (error && !error.message.includes('duplicate')) { toast.error(error.message); return }
      setAssigned(prev => [...prev, cat])
      toast.success(`"${cat.name}" add kiya`)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-1">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
      <span className="text-xs text-slate-400">Loading...</span>
    </div>
  )

  return (
    <div className="relative" ref={ref}>
      {/* Assigned badges + add button */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {assigned.map(cat => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-white cursor-default"
            style={{ backgroundColor: cat.color }}
          >
            {cat.name}
            <button
              onClick={e => { e.stopPropagation(); toggleCategory(cat) }}
              className="hover:opacity-70 ml-0.5 transition-opacity"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-1.5 text-xs border transition-all rounded-full px-2.5 py-1 ${
            open
              ? 'border-brand-400 text-brand-600 bg-brand-50'
              : 'border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          <Tag className="w-3 h-3" />
          {assigned.length === 0 ? 'Category lagao' : 'Change'}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-9 left-0 z-40 bg-white border border-slate-200 rounded-xl shadow-elevated min-w-52 max-w-72 animate-in overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600">Categories select karo</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {allCategories.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-slate-400">Koi category nahi</p>
              <a href="/dashboard/categories" className="text-xs text-brand-600 hover:underline mt-1 block">
                Admin se banwao →
              </a>
            </div>
          ) : (
            <div className="py-1 max-h-60 overflow-y-auto">
              {allCategories.map(cat => {
                const isOn = assigned.some(a => a.id === cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      isOn ? 'bg-slate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                      style={{ backgroundColor: cat.color, ringColor: cat.color + '40' }}
                    />
                    <span className="flex-1 text-slate-700 font-medium">{cat.name}</span>
                    {isOn && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          <div className="px-3 py-2 border-t border-slate-100">
            <button onClick={() => setOpen(false)} className="w-full text-xs text-slate-500 hover:text-brand-600 text-center py-1">
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

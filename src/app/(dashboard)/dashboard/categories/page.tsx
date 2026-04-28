'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Check, X, Loader2, Tag, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import type { LeadCategory } from '@/types'

const PRESET_COLORS = [
  '#16a34a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#14b8a6', '#6366f1', '#ef4444', '#f97316', '#0ea5e9',
  '#84cc16', '#a855f7', '#06b6d4', '#d97706', '#64748b',
]

export default function CategoriesPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const emptyForm = { name: '', color: '#16a34a', description: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadCategories() }, [])

  const loadCategories = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('lead_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setCategories(data as any)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Category name zaroori hai'); return }
    setSaving(true)
    const { data, error } = await supabase.from('lead_categories').insert({
      name: form.name.trim(),
      color: form.color,
      description: form.description.trim() || null,
      created_by: profile?.id,
      sort_order: categories.length,
    }).select().single()
    if (error) { toast.error(error.message); setSaving(false); return }
    setCategories(prev => [...prev, data as any])
    setForm(emptyForm)
    setShowAdd(false)
    setSaving(false)
    toast.success('Category add ho gayi!')
  }

  const handleEdit = async (id: string) => {
    if (!form.name.trim()) { toast.error('Name zaroori hai'); return }
    setSaving(true)
    const { error } = await supabase.from('lead_categories').update({
      name: form.name.trim(),
      color: form.color,
      description: form.description.trim() || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); setSaving(false); return }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: form.name.trim(), color: form.color, description: form.description } : c))
    setEditId(null)
    setSaving(false)
    toast.success('Category update ho gayi!')
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" delete karna chahte ho? Leads se bhi hata diya jayega.`)) return
    await supabase.from('lead_category_map').delete().eq('category_id', id)
    await supabase.from('lead_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category delete ho gayi')
  }

  const toggleActive = async (cat: LeadCategory) => {
    await supabase.from('lead_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
  }

  const startEdit = (cat: LeadCategory) => {
    setEditId(cat.id)
    setForm({ name: cat.name, color: cat.color, description: cat.description ?? '' })
    setShowAdd(false)
  }

  const CategoryForm = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Category Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. School Group, Corporate..."
            autoFocus
          />
        </div>
        <div>
          <label className="label">Description</label>
          <input
            className="input"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional description..."
          />
        </div>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setForm(f => ({ ...f, color }))}
              className={`w-7 h-7 rounded-full transition-all border-2 ${form.color === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            value={form.color}
            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="w-7 h-7 rounded-full cursor-pointer border border-slate-200"
            title="Custom color"
          />
          <span className="text-xs text-slate-500 font-mono">{form.color}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save
        </button>
        <button onClick={onCancel} className="btn-secondary">
          <X className="w-4 h-4" /> Cancel
        </button>
        {/* Preview badge */}
        {form.name && (
          <span
            className="badge text-white ml-auto self-center"
            style={{ backgroundColor: form.color }}
          >
            {form.name}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Lead Categories</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Custom categories banao — leads ko categorise karo aur filter karo
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditId(null); setForm(emptyForm) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* How it works */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-brand-800 mb-2">Kaise kaam karta hai?</p>
        <ul className="space-y-1 text-sm text-brand-700">
          <li>✅ Admin yahan categories banata hai (jaise: School Group, Corporate, Honeymoon)</li>
          <li>✅ Leads page mein category filter dikhai dega — kisi bhi lead ko category assign karo</li>
          <li>✅ Employee bhi apni assigned leads pe categories set kar sakta hai</li>
          <li>✅ Calling view mein bhi category ke hisab se filter hoga</li>
        </ul>
      </div>

      {/* Add form */}
      {showAdd && (
        <CategoryForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Categories list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : categories.length === 0 ? (
        <div className="card py-16 flex flex-col items-center text-slate-400 gap-3">
          <Tag className="w-12 h-12 opacity-20" />
          <p className="font-medium text-slate-500">Koi category nahi hai</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Pehli category banao
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id}>
              {editId === cat.id ? (
                <CategoryForm
                  onSave={() => handleEdit(cat.id)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className={`card p-4 flex items-center gap-4 ${!cat.is_active ? 'opacity-50' : ''}`}>
                  {/* Color dot */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-offset-2"
                    style={{
                      backgroundColor: cat.color,
                      boxShadow: `0 0 0 2px ${cat.color}`
                    }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="badge text-white font-medium"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.name}
                      </span>
                      {!cat.is_active && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(cat)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${cat.is_active
                          ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          : 'border-brand-200 text-brand-600 hover:bg-brand-50'
                        }`}
                    >
                      {cat.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => startEdit(cat)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

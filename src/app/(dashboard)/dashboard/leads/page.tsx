'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Upload, RefreshCw, UserCheck, CheckSquare, Square,
  X, Search, Filter, Loader2, Phone, Mail, Tag,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { useEmployees } from '@/hooks/useEmployees'
import StatusBadge from '@/components/ui/StatusBadge'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import CSVUploadModal from '@/components/leads/CSVUploadModal'
import AssignLeadModal from '@/components/leads/AssignLeadModal'
import AddLeadModal from '@/components/leads/AddLeadModal'
import BulkAssignModal from '@/components/leads/BulkAssignModal'
import type { Lead, LeadFilters, LeadStatus, LeadCategory } from '@/types'
import { formatDateIST, formatDateTimeIST } from '@/lib/dateUtils'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const STATUS_OPTIONS: { value: LeadStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'new', label: '🆕 New' },
  { value: 'hot', label: '🔥 Hot' },
  { value: 'follow_up', label: '🕐 Follow Up' },
  { value: 'callback', label: '📅 Callback' },
  { value: 'rnr', label: '📵 RNR' },
  { value: 'cold', label: '❄️ Cold' },
  { value: 'not_interested', label: '🚫 Not Interested' },
  { value: 'converted', label: '✅ Converted' },
  { value: 'booked', label: '📖 Booked' },
]

export default function LeadsPage() {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const { employees } = useEmployees()
  const isAdmin = profile?.role === 'admin'

  // Data
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<LeadCategory[]>([])

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Filters
  const [filters, setFilters] = useState<LeadFilters & { category_id?: string }>({})
  const [showFilters, setShowFilters] = useState(false)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allOnPageSelected = leads.length > 0 && leads.every(l => selected.has(l.id))

  // Modals
  const [viewLead, setViewLead] = useState<Lead | null>(null)
  const [assignLead, setAssignLead] = useState<Lead | null>(null)
  const [showCSV, setShowCSV] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulkAssign, setShowBulkAssign] = useState(false)

  const searchTimer = useRef<any>(null)

  // Load categories
  useEffect(() => {
    supabase.from('lead_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setCategories(data as any) })
  }, [])

  const fetchLeads = useCallback(async (f?: typeof filters, p?: number, ps?: number) => {
    if (!profile) return
    setLoading(true)
    const active = f ?? filters
    const currentPage = p ?? page
    const currentPageSize = ps ?? pageSize
    const from = (currentPage - 1) * currentPageSize
    const to = from + currentPageSize - 1

    // Category filter — get lead_ids that have this category
    let categoryLeadIds: string[] | null = null
    if (active.category_id) {
      const { data: mapped } = await supabase
        .from('lead_category_map')
        .select('lead_id')
        .eq('category_id', active.category_id)
      categoryLeadIds = mapped?.map(m => m.lead_id) ?? []
      if (categoryLeadIds.length === 0) {
        setLeads([]); setTotal(0); setLoading(false); return
      }
    }

    let q = supabase
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(id, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (profile.role === 'employee') q = q.eq('assigned_to', profile.id)
    if (active.status) q = q.eq('status', active.status)
    if (active.assigned_to) q = q.eq('assigned_to', active.assigned_to)
    if (active.assigned_date) q = q.eq('assigned_date', active.assigned_date)
    if (active.last_called_date) q = q.eq('last_called_date', active.last_called_date)
    if (active.travel_date) q = q.eq('travel_date', active.travel_date)
    if (active.destination) q = q.or(`destination.ilike.%${active.destination}%,trip_interest.ilike.%${active.destination}%`)
    if (active.search) {
      const s = active.search.trim()
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`)
    }
    if (categoryLeadIds) q = q.in('id', categoryLeadIds)

    const { data, count, error } = await q
    if (!error && data) { setLeads(data as any); setTotal(count ?? 0) }
    setLoading(false)
  }, [profile?.id, filters, page, pageSize])

  useEffect(() => { fetchLeads() }, [profile?.id])

  // Realtime updates
  useEffect(() => {
    if (!profile) return
    const ch = supabase.channel('leads-rt-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id])

  const updateFilter = (key: string, val: string) => {
    const f = { ...filters, [key]: val }
    setFilters(f)
    setPage(1)
    clearTimeout(searchTimer.current)
    if (key === 'search') {
      searchTimer.current = setTimeout(() => fetchLeads(f, 1), 350)
    } else {
      fetchLeads(f, 1)
    }
  }

  const clearFilters = () => { setFilters({}); setPage(1); fetchLeads({}, 1) }
  const hasFilters = Object.values(filters).some(v => v)

  // Page change
  const goToPage = (p: number) => {
    const np = Math.max(1, Math.min(totalPages, p))
    setPage(np)
    fetchLeads(filters, np)
  }

  // Selection
  const toggleSelect = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const togglePageSelect = () => {
    if (allOnPageSelected) {
      setSelected(prev => { const n = new Set(prev); leads.forEach(l => n.delete(l.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); leads.forEach(l => n.add(l.id)); return n })
    }
  }

  const activeFiltersCount = Object.values(filters).filter(v => v).length

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? '...' : `${total.toLocaleString()} leads`}
            {!isAdmin ? ' (your leads)' : ''}
            {selected.size > 0 && <span className="ml-2 text-brand-600 font-semibold">· {selected.size} selected</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => setShowBulkAssign(true)} className="btn-primary">
              <UserCheck className="w-4 h-4" /> Assign {selected.size} Leads
            </button>
          )}
          <button onClick={() => fetchLeads()} className="btn-secondary px-3" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary relative ${showFilters ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button onClick={() => setShowCSV(true)} className="btn-secondary">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        </div>
      </div>

      {/* Category quick filter pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => updateFilter('category_id', '')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
              !filters.category_id ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => updateFilter('category_id', filters.category_id === cat.id ? '' : cat.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all flex items-center gap-1 ${
                filters.category_id === cat.id
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 hover:border-current'
              }`}
              style={
                filters.category_id === cat.id
                  ? { backgroundColor: cat.color, borderColor: cat.color }
                  : { borderColor: cat.color + '80', color: cat.color }
              }
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: filters.category_id === cat.id ? '#fff' : cat.color }} />
              {cat.name}
            </button>
          ))}
          {isAdmin && (
            <a href="/dashboard/categories" className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border-2 border-dashed border-slate-200 text-slate-400 hover:border-brand-400 hover:text-brand-600 transition-all whitespace-nowrap">
              + Manage
            </a>
          )}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-4 space-y-3 animate-in">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Advanced Filters
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" className="input pl-9" placeholder="Naam, phone, email..."
                value={filters.search ?? ''} onChange={e => updateFilter('search', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status ?? ''} onChange={e => updateFilter('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Destination / Trip</label>
              <input type="text" className="input" placeholder="Goa, Manali, Europe..."
                value={filters.destination ?? ''} onChange={e => updateFilter('destination', e.target.value)} />
            </div>
            {isAdmin && (
              <div>
                <label className="label">Assigned Employee</label>
                <select className="select" value={filters.assigned_to ?? ''} onChange={e => updateFilter('assigned_to', e.target.value)}>
                  <option value="">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Assigned Date</label>
              <input type="date" className="input" value={filters.assigned_date ?? ''} onChange={e => updateFilter('assigned_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Last Called Date</label>
              <input type="date" className="input" value={filters.last_called_date ?? ''} onChange={e => updateFilter('last_called_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Travel Date</label>
              <input type="date" className="input" value={filters.travel_date ?? ''} onChange={e => updateFilter('travel_date', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).filter(([, v]) => v).map(([key, val]) => {
            let label = String(val)
            if (key === 'category_id') label = categories.find(c => c.id === val)?.name ?? val
            if (key === 'assigned_to') label = employees.find(e => e.id === val)?.full_name ?? val
            return (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-1 rounded-full font-medium">
                {key.replace(/_/g, ' ')}: {label}
                <button onClick={() => updateFilter(key, '')} className="hover:text-red-500 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-5xl mb-3">🗂️</p>
            <p className="font-medium text-slate-500">Koi lead nahi mili</p>
            <p className="text-sm mt-1">Filters change karo ya naya lead add karo</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="table-head w-10">
                        <button onClick={togglePageSelect} className="text-slate-400 hover:text-brand-600">
                          {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="table-head">Lead</th>
                    <th className="table-head">Contact</th>
                    <th className="table-head">Trip / Destination</th>
                    <th className="table-head text-center">Persons</th>
                    <th className="table-head">Budget</th>
                    <th className="table-head">Travel Date</th>
                    <th className="table-head">Status</th>
                    {isAdmin && <th className="table-head">Assigned To</th>}
                    <th className="table-head">Last Called</th>
                    <th className="table-head">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/60 transition-colors ${selected.has(lead.id) ? 'bg-brand-50/40' : ''}`}
                    >
                      {isAdmin && (
                        <td className="table-cell">
                          <button onClick={() => toggleSelect(lead.id)} className="text-slate-300 hover:text-brand-600">
                            {selected.has(lead.id) ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                      )}
                      <td className="table-cell min-w-36">
                        <div>
                          <button
                            onClick={() => setViewLead(lead)}
                            className="font-medium text-slate-900 hover:text-brand-600 text-left leading-tight"
                          >
                            {lead.name}
                          </button>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDateIST(lead.created_at)}</p>
                        </div>
                      </td>
                      <td className="table-cell min-w-32">
                        <div className="space-y-0.5">
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-brand-600 text-xs">
                            <Phone className="w-3 h-3 flex-shrink-0" /> {lead.phone}
                          </a>
                          {lead.email && (
                            <div className="flex items-center gap-1 text-slate-500 text-xs truncate max-w-36">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell min-w-28">
                        <span className="text-slate-600 text-xs truncate block max-w-28">
                          {lead.destination || lead.trip_interest || '—'}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <span className="text-slate-700 font-medium text-xs">{lead.person_count ?? 1}</span>
                      </td>
                      <td className="table-cell text-slate-700 text-xs whitespace-nowrap">
                        {lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="table-cell text-slate-600 text-xs whitespace-nowrap">
                        {lead.travel_date ? formatDateIST(lead.travel_date + 'T00:00:00') : '—'}
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={lead.status} />
                      </td>
                      {isAdmin && (
                        <td className="table-cell min-w-28">
                          {lead.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-brand-700 text-[9px] font-bold">
                                  {lead.assignee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <span className="text-xs text-slate-700 truncate max-w-20">{lead.assignee.full_name}</span>
                            </div>
                          ) : <span className="text-xs text-slate-400">Unassigned</span>}
                        </td>
                      )}
                      <td className="table-cell text-xs text-slate-500 whitespace-nowrap">
                        {lead.last_called_at ? formatDateTimeIST(lead.last_called_at) : '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setViewLead(lead)} className="text-xs text-brand-600 hover:underline font-medium whitespace-nowrap">
                            View
                          </button>
                          {isAdmin && (
                            <button onClick={() => setAssignLead(lead)} className="text-xs text-slate-400 hover:text-blue-600 whitespace-nowrap">
                              Assign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
                </span>
                <select
                  className="select text-xs w-auto py-1 px-2"
                  value={pageSize}
                  onChange={e => { const ps = Number(e.target.value); setPageSize(ps); setPage(1); fetchLeads(filters, 1, ps) }}
                >
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1">
                {/* First */}
                <button onClick={() => goToPage(1)} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                {/* Prev */}
                <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {(() => {
                  const pages: (number | '...')[] = []
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                  } else {
                    pages.push(1)
                    if (page > 3) pages.push('...')
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
                    if (page < totalPages - 2) pages.push('...')
                    pages.push(totalPages)
                  }
                  return pages.map((p, i) =>
                    p === '...' ? (
                      <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          page === p
                            ? 'bg-brand-600 text-white border border-brand-600'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                })()}

                {/* Next */}
                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Last */}
                <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <LeadDetailModal lead={viewLead} onClose={() => { setViewLead(null); fetchLeads() }} employees={employees} isAdmin={isAdmin} />
      <AssignLeadModal lead={assignLead} employees={employees} onClose={() => { setAssignLead(null); fetchLeads() }} />
      <CSVUploadModal open={showCSV} onClose={() => setShowCSV(false)} onSuccess={() => fetchLeads()} />
      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => fetchLeads()} employees={employees} isAdmin={isAdmin} />
      <BulkAssignModal
        open={showBulkAssign}
        leadIds={[...selected]}
        employees={employees}
        onClose={() => setShowBulkAssign(false)}
        onSuccess={() => { setSelected(new Set()); setShowBulkAssign(false); fetchLeads() }}
      />
    </div>
  )
}

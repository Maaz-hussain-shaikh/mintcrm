'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { LeadFilters, Profile } from '@/types'

interface Props {
  filters: LeadFilters
  onChange: (f: LeadFilters) => void
  employees: Profile[]
  showAssigneeFilter?: boolean
}

const statuses = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'hot', label: 'Hot 🔥' },
  { value: 'cold', label: 'Cold' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
]

export default function LeadFiltersBar({ filters, onChange, employees, showAssigneeFilter = true }: Props) {
  const hasFilters = filters.status || filters.assigned_to || filters.search || filters.follow_up_date

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Search name, phone, email…"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Status */}
      <select
        className="select w-auto min-w-36"
        value={filters.status ?? ''}
        onChange={(e) => onChange({ ...filters, status: e.target.value as any })}
      >
        {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Assigned to */}
      {showAssigneeFilter && (
        <select
          className="select w-auto min-w-40"
          value={filters.assigned_to ?? ''}
          onChange={(e) => onChange({ ...filters, assigned_to: e.target.value })}
        >
          <option value="">All Employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      )}

      {/* Follow-up date */}
      <input
        type="date"
        className="input w-auto"
        value={filters.follow_up_date ?? ''}
        onChange={(e) => onChange({ ...filters, follow_up_date: e.target.value })}
        title="Filter by follow-up date"
      />

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="btn-secondary text-slate-500 gap-1.5"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}
    </div>
  )
}

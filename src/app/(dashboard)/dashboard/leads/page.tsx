'use client'

import { useState, useEffect } from 'react'
import { Plus, Upload, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLeads } from '@/hooks/useLeads'
import { useEmployees } from '@/hooks/useEmployees'
import { useLeadsStore } from '@/store/leads'
import { useAuthStore } from '@/store/auth'
import LeadsTable from '@/components/leads/LeadsTable'
import LeadFiltersBar from '@/components/leads/LeadFiltersBar'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import CSVUploadModal from '@/components/leads/CSVUploadModal'
import AssignLeadModal from '@/components/leads/AssignLeadModal'
import AddLeadModal from '@/components/leads/AddLeadModal'
import type { Lead } from '@/types'

export default function LeadsPage() {
  const { profile } = useAuthStore()
  const { leads, loading, fetchLeads } = useLeads()
  const { filters, setFilters } = useLeadsStore()
  const { employees } = useEmployees()

  const [viewLead, setViewLead] = useState<Lead | null>(null)
  const [assignLead, setAssignLead] = useState<Lead | null>(null)
  const [showCSV, setShowCSV] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const handleFilterChange = (f: typeof filters) => {
    setFilters(f)
    fetchLeads(f)
  }

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 text-sm mt-0.5">{leads.length} leads {!isAdmin ? '(assigned to you)' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLeads()} className="btn-secondary" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={() => setShowCSV(true)} className="btn-secondary">
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <LeadFiltersBar
          filters={filters}
          onChange={handleFilterChange}
          employees={employees}
          showAssigneeFilter={isAdmin}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <LeadsTable
            leads={leads}
            onView={setViewLead}
            onAssign={isAdmin ? setAssignLead : undefined}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Modals */}
      <LeadDetailModal
        lead={viewLead}
        onClose={() => setViewLead(null)}
        employees={employees}
        isAdmin={isAdmin}
      />
      <AssignLeadModal
        lead={assignLead}
        employees={employees}
        onClose={() => setAssignLead(null)}
      />
      <CSVUploadModal
        open={showCSV}
        onClose={() => setShowCSV(false)}
        onSuccess={() => fetchLeads()}
      />
      <AddLeadModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => fetchLeads()}
        employees={employees}
        isAdmin={isAdmin}
      />
    </div>
  )
}

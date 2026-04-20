import { create } from 'zustand'
import type { Lead, LeadFilters } from '@/types'

interface LeadsState {
  leads: Lead[]
  filters: LeadFilters
  loading: boolean
  selectedLead: Lead | null
  setLeads: (leads: Lead[]) => void
  updateLead: (id: string, data: Partial<Lead>) => void
  setFilters: (filters: LeadFilters) => void
  setLoading: (loading: boolean) => void
  setSelectedLead: (lead: Lead | null) => void
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  filters: {},
  loading: false,
  selectedLead: null,
  setLeads: (leads) => set({ leads }),
  updateLead: (id, data) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...data } : l)),
    })),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ loading }),
  setSelectedLead: (selectedLead) => set({ selectedLead }),
}))

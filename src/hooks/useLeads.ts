'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLeadsStore } from '@/store/leads'
import { useAuthStore } from '@/store/auth'
import type { LeadFilters } from '@/types'

export function useLeads() {
  const supabase = createClient()
  const { profile } = useAuthStore()
  const { leads, filters, loading, setLeads, setLoading, updateLead } = useLeadsStore()

  const fetchLeads = useCallback(async (f?: LeadFilters) => {
    if (!profile) return
    setLoading(true)
    const activeFilters = f ?? filters

    let query = supabase
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(id, full_name, email)')
      .order('created_at', { ascending: false })

    // Employees only see their assigned leads
    if (profile.role === 'employee') {
      query = query.eq('assigned_to', profile.id)
    }

    if (activeFilters.status) {
      query = query.eq('status', activeFilters.status)
    }
    if (activeFilters.assigned_to) {
      query = query.eq('assigned_to', activeFilters.assigned_to)
    }
    if (activeFilters.follow_up_date) {
      const date = activeFilters.follow_up_date
      query = query.gte('follow_up_at', date + 'T00:00:00').lte('follow_up_at', date + 'T23:59:59')
    }
    if (activeFilters.search) {
      const s = activeFilters.search.trim()
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`)
    }

    const { data, error } = await query.limit(200)
    if (!error && data) setLeads(data as any)
    setLoading(false)
  }, [profile, filters, supabase, setLeads, setLoading])

  // Realtime subscription
  useEffect(() => {
    if (!profile) return

    fetchLeads()

    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
      }, () => {
        fetchLeads()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  return { leads, loading, fetchLeads }
}

'use client'

import { format } from 'date-fns'
import { Phone, Mail, Eye, MoreVertical, UserCheck } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Lead, Profile } from '@/types'

interface Props {
  leads: Lead[]
  onView: (lead: Lead) => void
  onAssign?: (lead: Lead) => void
  isAdmin?: boolean
}

export default function LeadsTable({ leads, onView, onAssign, isAdmin }: Props) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">🗂️</p>
        <p className="font-medium text-slate-500">No leads found</p>
        <p className="text-sm">Try adjusting your filters or add new leads</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-y border-slate-100">
          <tr>
            <th className="table-head">Lead</th>
            <th className="table-head">Contact</th>
            <th className="table-head">Trip Interest</th>
            <th className="table-head">Budget</th>
            <th className="table-head">Travel Date</th>
            <th className="table-head">Status</th>
            <th className="table-head">Assigned To</th>
            <th className="table-head">Follow Up</th>
            <th className="table-head"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="table-cell">
                <div>
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </td>
              <td className="table-cell">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                    <Phone className="w-3 h-3" />
                    <a href={`tel:${lead.phone}`} className="hover:text-brand-600">{lead.phone}</a>
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                      <Mail className="w-3 h-3" />
                      <a href={`mailto:${lead.email}`} className="hover:text-brand-600 truncate max-w-32">{lead.email}</a>
                    </div>
                  )}
                </div>
              </td>
              <td className="table-cell text-slate-600">{lead.trip_interest || '—'}</td>
              <td className="table-cell text-slate-600">
                {lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}
              </td>
              <td className="table-cell text-slate-600">
                {lead.travel_date ? format(new Date(lead.travel_date), 'MMM d, yyyy') : '—'}
              </td>
              <td className="table-cell">
                <StatusBadge status={lead.status} />
              </td>
              <td className="table-cell">
                {lead.assignee ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-700 text-[10px] font-semibold">
                        {lead.assignee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-slate-700 truncate max-w-24">{lead.assignee.full_name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">Unassigned</span>
                )}
              </td>
              <td className="table-cell">
                {lead.follow_up_at ? (
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    {format(new Date(lead.follow_up_at), 'MMM d, h:mm a')}
                  </span>
                ) : '—'}
              </td>
              <td className="table-cell">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onView(lead)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    title="View lead"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {isAdmin && onAssign && (
                    <button
                      onClick={() => onAssign(lead)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Assign lead"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import type { LeadStatus } from '@/types'

const config:Partial <Record<LeadStatus, { label: string; classes: string }>> = {
  new:            { label: 'New',            classes: 'bg-blue-50 text-blue-700' },
  hot:            { label: 'Hot 🔥',          classes: 'bg-orange-50 text-orange-700' },
  cold:           { label: 'Cold',           classes: 'bg-slate-100 text-slate-600' },
  not_interested: { label: 'Not Interested', classes: 'bg-red-50 text-red-600' },
  follow_up:      { label: 'Follow Up',      classes: 'bg-purple-50 text-purple-700' },
  converted:      { label: 'Converted ✓',    classes: 'bg-brand-50 text-brand-700' },
}

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, classes } = config[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600' }
  return <span className={`badge ${classes}`}>{label}</span>
}

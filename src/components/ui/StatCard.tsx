import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'green' | 'blue' | 'orange' | 'purple' | 'slate'
  subtitle?: string
}

const colorMap = {
  green:  { icon: 'text-brand-600',  bg: 'bg-brand-50' },
  blue:   { icon: 'text-blue-600',   bg: 'bg-blue-50' },
  orange: { icon: 'text-orange-600', bg: 'bg-orange-50' },
  purple: { icon: 'text-purple-600', bg: 'bg-purple-50' },
  slate:  { icon: 'text-slate-600',  bg: 'bg-slate-100' },
}

export default function StatCard({ title, value, icon: Icon, color = 'green', subtitle }: StatCardProps) {
  const colors = colorMap[color]
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-display font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>
    </div>
  )
}

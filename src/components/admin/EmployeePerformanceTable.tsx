import { format } from 'date-fns'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import type { EmployeeStats } from '@/types'

interface Props {
  stats: EmployeeStats[]
}

function minutesToHHMM(minutes: number | null | undefined) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

export default function EmployeePerformanceTable({ stats }: Props) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">👥</p>
        <p className="font-medium text-slate-500">No employees yet</p>
        <p className="text-sm">Employees will appear here once they sign up</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-y border-slate-100">
          <tr>
            <th className="table-head">Employee</th>
            <th className="table-head">Leads Assigned</th>
            <th className="table-head">Calls Made</th>
            <th className="table-head">Converted</th>
            <th className="table-head">Conv. Rate</th>
            <th className="table-head">Today Check-in</th>
            <th className="table-head">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {stats.map(({ profile, total_leads, calls_made, converted, attendance_today }) => {
            const rate = total_leads > 0 ? Math.round((converted / total_leads) * 100) : 0
            const isOnline = attendance_today && !attendance_today.check_out
            return (
              <tr key={profile.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-700 text-xs font-semibold">
                        {profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
                      <p className="text-xs text-slate-400">{profile.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <span className="font-semibold text-slate-900">{total_leads}</span>
                </td>
                <td className="table-cell">
                  <span className="font-semibold text-blue-700">{calls_made}</span>
                </td>
                <td className="table-cell">
                  <span className="font-semibold text-brand-700">{converted}</span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600">{rate}%</span>
                  </div>
                </td>
                <td className="table-cell text-sm text-slate-600">
                  {attendance_today
                    ? format(new Date(attendance_today.check_in), 'h:mm a')
                    : <span className="text-slate-400">Not checked in</span>
                  }
                </td>
                <td className="table-cell">
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full pulse-dot" />
                      Online
                    </span>
                  ) : attendance_today?.check_out ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {minutesToHHMM(attendance_today.total_minutes)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Offline
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

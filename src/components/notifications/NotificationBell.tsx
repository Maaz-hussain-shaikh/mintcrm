'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, CheckCheck, X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationsStore } from '@/store/notifications'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { notifications, unreadCount, setNotifications, addNotification, markRead, markAllRead } = useNotificationsStore()

  // Click outside closes
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Poll every 30s for due follow-ups
  useEffect(() => {
    const check = async () => {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('notifications')
        .select('*, lead:leads(name)')
        .lte('scheduled_at', now)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data && data.length > 0) {
        setNotifications(data as any)
        // Pop toast for newly due ones
        const veryRecent = data.filter(n => {
          const sched = n.scheduled_at ? new Date(n.scheduled_at) : null
          if (!sched) return false
          const diffMin = (Date.now() - sched.getTime()) / 60000
          return diffMin < 2 // due within last 2 mins
        })
        veryRecent.forEach(n => toast(n.message, { icon: '🔔', duration: 6000 }))
      }
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  const handleMarkRead = async (id: string) => {
    markRead(id)
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const handleMarkAllRead = async () => {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id)
    markAllRead()
    if (ids.length) await supabase.from('notifications').update({ is_read: true }).in('id', ids)
  }

  const isOverdue = (n: any) =>
    n.scheduled_at && isPast(parseISO(n.scheduled_at)) && !n.is_read

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
          unreadCount > 0 ? 'text-brand-600 bg-brand-50 hover:bg-brand-100' : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-2xl border border-slate-100 shadow-elevated z-50 animate-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadCount} new</span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" /> Sab read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Koi notification nahi</p>
              </div>
            ) : (
              notifications.slice(0, 30).map((n: any) => {
                const overdue = isOverdue(n)
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 transition-colors ${
                      overdue
                        ? 'bg-red-50 hover:bg-red-100'
                        : !n.is_read
                        ? 'bg-brand-50/50 hover:bg-brand-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {overdue
                        ? <AlertCircle className="w-4 h-4 text-red-500" />
                        : <div className={`w-2 h-2 rounded-full mt-1 ${!n.is_read ? 'bg-brand-500' : 'bg-transparent'}`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${overdue ? 'text-red-800' : 'text-slate-900'}`}>
                          {n.title}
                          {overdue && (
                            <span className="ml-2 text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                              OVERDUE
                            </span>
                          )}
                        </p>
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="flex-shrink-0 text-slate-300 hover:text-brand-500 mt-0.5"
                            title="Mark read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${overdue ? 'text-red-700' : 'text-slate-500'}`}>
                        {n.message}
                      </p>
                      {n.lead?.name && (
                        <p className="text-xs text-slate-400 mt-0.5">Lead: {n.lead.name}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

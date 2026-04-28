'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Calendar, LogOut, Leaf ,
  BarChart3, ClipboardList, Phone, ChevronRight, Menu, X, FileBarChart, Star, Tag as Tag2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'
import { useNotificationsStore } from '@/store/notifications'
import NotificationBell from '@/components/notifications/NotificationBell'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
  children: React.ReactNode
}

const navItems = (role: string) => [
  { href: '/dashboard',             label: 'Dashboard',    icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { href: '/dashboard/leads',       label: 'Leads',        icon: Users,           roles: ['admin', 'employee'] },
  { href: '/dashboard/calling',     label: 'Calling View', icon: Phone,           roles: ['admin', 'employee'] },
  { href: '/dashboard/admin',       label: 'Admin Panel',  icon: BarChart3,       roles: ['admin'] },
  { href: '/dashboard/reports',      label: 'Reports',      icon: FileBarChart,    roles: ['admin'] },
  { href: '/dashboard/categories',   label: 'Categories',   icon: Tag2,            roles: ['admin'] },
  { href: '/dashboard/my-customers', label: 'My Customers', icon: Star,            roles: ['admin', 'employee'] },
  { href: '/dashboard/attendance',  label: 'Attendance',   icon: Calendar,        roles: ['admin'] },
  { href: '/dashboard/activities',  label: 'Activities',   icon: ClipboardList,   roles: ['admin'] },
].filter(item => item.roles.includes(role))

export default function DashboardShell({ profile, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { setProfile, setAttendanceId, attendanceId, reset } = useAuthStore()
  const { setNotifications, addNotification } = useNotificationsStore()
  const checkedIn = useRef(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { setProfile(profile) }, [profile, setProfile])

  // Auto check-in
  useEffect(() => {
    if (checkedIn.current) return
    checkedIn.current = true
    async function checkIn() {
      // IST date using Intl (correct, no double offset)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const { data: existing } = await supabase
        .from('attendance').select('id, check_out')
        .eq('user_id', profile.id).eq('date', today).maybeSingle()
      if (existing && !existing.check_out) { setAttendanceId(existing.id); return }
      const { data } = await supabase
        .from('attendance').insert({ user_id: profile.id, date: today })
        .select('id').single()
      if (data) setAttendanceId(data.id)
    }
    checkIn()
  }, [profile.id])

  // Auto check-out on unload
  useEffect(() => {
    const handler = () => {
      if (!attendanceId) return
      const blob = new Blob([JSON.stringify({ attendanceId })], { type: 'application/json' })
      navigator.sendBeacon('/api/attendance/checkout', blob)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [attendanceId])

  // Load notifications + realtime
  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('notifications').select('*, lead:leads(name)')
        .eq('user_id', profile.id).lte('scheduled_at', now)
        .order('created_at', { ascending: false }).limit(50)
      if (data) setNotifications(data as any)
    }
    load()
    const channel = supabase.channel('notifs-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as any
          const sched = n.scheduled_at ? new Date(n.scheduled_at) : new Date()
          if (sched <= new Date()) { addNotification(n); toast(n.message, { icon: '🔔' }) }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  const handleLogout = async () => {
    if (attendanceId) {
      await supabase.from('attendance').update({ check_out: new Date().toISOString() }).eq('id', attendanceId)
    }
    reset()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const items = navItems(profile.role)

  // Close sidebar when route changes
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200 ">
            <Leaf className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Mint<span className="text-green-600">CRM</span></h2>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-brand-400" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 text-xs font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-subtle">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-white border-r border-slate-100 flex-col h-full">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="h-16 lg:hidden flex items-center px-5 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200 ">
                <Leaf className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Mint<span className="text-green-600">CRM</span></h2>
            </div>
          </div>

          <div className="flex-1 lg:flex-none" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            {/* Mobile user avatar */}
            <div className="lg:hidden w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-700 text-xs font-semibold">{initials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export type UserRole = 'admin' | 'employee'

export type LeadStatus = 'new' | 'hot' | 'cold' | 'not_interested' | 'follow_up' | 'converted' | 'callback' | 'rnr' | 'booked'

export type ActivityType = 'status_change' | 'note_added' | 'call_made' | 'assigned' | 'follow_up_set'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string | null
  phone?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string | null
  trip_interest?: string | null
  travel_date?: string | null
  budget?: number | null
  status: LeadStatus
  assigned_to?: string | null
  follow_up_at?: string | null
  notes?: string | null
  source: string
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joined
  assignee?: Profile | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  user_id: string
  activity_type: ActivityType
  old_value?: string | null
  new_value?: string | null
  note?: string | null
  created_at: string
  // Joined
  user?: Profile | null
}

export interface Attendance {
  id: string
  user_id: string
  check_in: string
  check_out?: string | null
  total_minutes?: number | null
  date: string
  created_at: string
  updated_at: string
  // Joined
  user?: Profile | null
}

export interface Notification {
  id: string
  user_id: string
  lead_id?: string | null
  title: string
  message: string
  is_read: boolean
  notification_type: string
  scheduled_at?: string | null
  created_at: string
  // Joined
  lead?: Lead | null
}

export interface LeadFilters {
  status?: LeadStatus | ''
  assigned_to?: string | ''
  follow_up_date?: string | ''
  search?: string
}

export interface EmployeeStats {
  profile: Profile
  total_leads: number
  calls_made: number
  converted: number
  attendance_today?: Attendance | null
}

export interface CSVLeadRow {
  name: string
  phone: string
  email?: string
  trip_interest?: string
  travel_date?: string
  budget?: string
}

export interface CustomerList {
  id: string
  user_id: string
  lead_id: string
  list_type: 'hot' | 'booked'
  note?: string | null
  created_at: string
  updated_at: string
  lead?: Lead | null
}

export interface EmployeeDailyReport {
  profile: Profile
  total_assigned: number
  called_today: number
  not_called_today: number
  callbacks_due: number
  rnr_count: number
  converted_total: number
  hot_leads: number
  booked_leads: number
  recent_calls: LeadActivity[]
  attendance_today?: Attendance | null
}

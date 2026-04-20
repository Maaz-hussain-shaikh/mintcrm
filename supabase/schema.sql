-- ============================================================
-- TRAVEL CRM - COMPLETE SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE lead_status AS ENUM ('new', 'hot', 'cold', 'not_interested', 'follow_up', 'converted');
CREATE TYPE activity_type AS ENUM ('status_change', 'note_added', 'call_made', 'assigned', 'follow_up_set');

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  trip_interest TEXT,
  travel_date DATE,
  budget NUMERIC(12, 2),
  status lead_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  follow_up_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead Activities / Logs
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  total_minutes INTEGER,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  notification_type TEXT DEFAULT 'follow_up',
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_follow_up_at ON leads(follow_up_at);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_user_id ON lead_activities(user_id);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-calculate total_minutes on check_out
CREATE OR REPLACE FUNCTION calculate_work_minutes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out IS NOT NULL AND OLD.check_out IS NULL THEN
    NEW.total_minutes = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_calculate_minutes BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION calculate_work_minutes();

-- Create follow-up notification when lead follow_up_at is set
CREATE OR REPLACE FUNCTION create_follow_up_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.follow_up_at IS NOT NULL AND (OLD.follow_up_at IS NULL OR NEW.follow_up_at <> OLD.follow_up_at) THEN
    INSERT INTO notifications (user_id, lead_id, title, message, notification_type, scheduled_at)
    VALUES (
      COALESCE(NEW.assigned_to, NEW.created_by),
      NEW.id,
      'Follow-up Reminder',
      'Follow up with ' || NEW.name || ' about ' || COALESCE(NEW.trip_interest, 'their trip'),
      'follow_up',
      NEW.follow_up_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER lead_follow_up_notification
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION create_follow_up_notification();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');

-- LEADS policies
CREATE POLICY "leads_admin_all" ON leads
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "leads_employee_select" ON leads
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'employee' AND assigned_to = auth.uid()
  );

CREATE POLICY "leads_employee_update" ON leads
  FOR UPDATE USING (
    get_user_role(auth.uid()) = 'employee' AND assigned_to = auth.uid()
  );

-- LEAD ACTIVITIES policies
CREATE POLICY "activities_admin_all" ON lead_activities
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "activities_employee_select" ON lead_activities
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'employee' AND user_id = auth.uid()
  );

CREATE POLICY "activities_employee_insert" ON lead_activities
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ATTENDANCE policies
CREATE POLICY "attendance_admin_all" ON attendance
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "attendance_employee_own" ON attendance
  FOR ALL USING (user_id = auth.uid());

-- NOTIFICATIONS policies
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_activities;

-- ============================================================
-- SEED: Create first admin user (run AFTER signing up)
-- Replace 'your-user-id' with actual UUID from auth.users
-- ============================================================
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@yourcompany.com';

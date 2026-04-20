-- ============================================================
-- TRAVEL CRM v3 — NEW FEATURES SQL
-- Run this in Supabase SQL Editor (after existing schema)
-- ============================================================

-- 1. Add new lead statuses to support call flow
-- Drop old enum and recreate with new values
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'rnr';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'callback';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'booked';

-- 2. Add callback_at column to leads (when to call back)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rnr_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;

-- 3. Booked Customers table
CREATE TABLE IF NOT EXISTS booked_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  trip_interest TEXT,
  travel_date DATE,
  amount_paid NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  destination TEXT,
  booking_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Hot Customers table
CREATE TABLE IF NOT EXISTS hot_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  trip_interest TEXT,
  travel_date DATE,
  budget NUMERIC(12,2),
  reason TEXT,
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_booked_employee ON booked_customers(employee_id);
CREATE INDEX IF NOT EXISTS idx_booked_date ON booked_customers(booking_date);
CREATE INDEX IF NOT EXISTS idx_hot_employee ON hot_customers(employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_callback_at ON leads(callback_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_called ON leads(last_called_at);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON leads(status, assigned_to);

-- 6. Auto update trigger for new tables
CREATE TRIGGER booked_updated_at BEFORE UPDATE ON booked_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER hot_updated_at BEFORE UPDATE ON hot_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. RLS
ALTER TABLE booked_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_customers ENABLE ROW LEVEL SECURITY;

-- Admin sees all
CREATE POLICY "booked_admin_all" ON booked_customers
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "hot_admin_all" ON hot_customers
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Employee sees own
CREATE POLICY "booked_employee_own" ON booked_customers
  FOR ALL USING (employee_id = auth.uid());

CREATE POLICY "hot_employee_own" ON hot_customers
  FOR ALL USING (employee_id = auth.uid());

-- 8. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE booked_customers;
ALTER PUBLICATION supabase_realtime ADD TABLE hot_customers;

SELECT 'v3 schema applied successfully!' AS status;

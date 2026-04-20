-- ============================================================
-- NEW FEATURES SQL — Run this in Supabase SQL Editor
-- ============================================================

-- 1. New calling-specific statuses for leads
-- Pehle enum mein naye values add karo
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'callback';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'rnr';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'booked';

-- 2. Customer Lists table (employee ki personal lists)
CREATE TABLE IF NOT EXISTS customer_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL CHECK (list_type IN ('hot', 'booked')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lead_id, list_type)
);

-- 3. Callback date on leads (already have follow_up_at, add callback_at separately)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rnr_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hot_note TEXT;

-- 4. RLS for customer_lists
ALTER TABLE customer_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_lists_own" ON customer_lists
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "customer_lists_admin" ON customer_lists
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_customer_lists_user_id ON customer_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_lists_list_type ON customer_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_leads_callback_at ON leads(callback_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_called ON leads(last_called_at);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customer_lists;

-- 7. Updated_at trigger for customer_lists
CREATE TRIGGER customer_lists_updated_at BEFORE UPDATE ON customer_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'New features SQL done!' AS status;

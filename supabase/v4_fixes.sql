-- ============================================================
-- v4 FIXES SQL — Run in Supabase SQL Editor
-- ============================================================

-- 1. Fix timezone — Supabase ko IST set karo
-- (Supabase cloud pe ye directly nahi hota, 
--  isliye hum application level pe handle karenge)
-- Lekin ek helper function banate hain

-- 2. Add person_count column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS person_count INTEGER DEFAULT 1;

-- 3. Add destination column (trip_interest already hai but add separate)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS destination TEXT;

-- 4. Add assigned_date column (kab assign hua)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_date DATE;

-- 5. Add last_called_date for easy date filtering
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_called_date DATE;

-- 6. Trigger to auto-set assigned_date when assigned_to changes
CREATE OR REPLACE FUNCTION set_assigned_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_assigned_date ON leads;
CREATE TRIGGER leads_set_assigned_date
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_assigned_date();

-- Also set on insert
CREATE OR REPLACE FUNCTION set_assigned_date_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_assigned_date_insert ON leads;
CREATE TRIGGER leads_set_assigned_date_insert
  BEFORE INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION set_assigned_date_on_insert();

-- 7. Trigger to auto-set last_called_date when call activity logged
CREATE OR REPLACE FUNCTION update_last_called_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.activity_type = 'call_made' THEN
    UPDATE leads 
    SET last_called_date = CURRENT_DATE,
        last_called_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_update_last_called ON lead_activities;
CREATE TRIGGER activity_update_last_called
  AFTER INSERT ON lead_activities
  FOR EACH ROW EXECUTE FUNCTION update_last_called_date();

-- 8. Better indexes for new filters
CREATE INDEX IF NOT EXISTS idx_leads_assigned_date ON leads(assigned_date);
CREATE INDEX IF NOT EXISTS idx_leads_last_called_date ON leads(last_called_date);
CREATE INDEX IF NOT EXISTS idx_leads_travel_date ON leads(travel_date);
CREATE INDEX IF NOT EXISTS idx_leads_destination ON leads(destination);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON leads(status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_callback_at ON leads(callback_at);

-- 9. Update existing leads assigned_date
UPDATE leads SET assigned_date = created_at::date WHERE assigned_to IS NOT NULL AND assigned_date IS NULL;

SELECT 'v4 SQL complete!' AS status;

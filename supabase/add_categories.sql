-- ============================================================
-- CUSTOM CATEGORIES SQL — Run in Supabase SQL Editor
-- ============================================================

-- 1. Lead Categories table (admin creates these)
CREATE TABLE IF NOT EXISTS lead_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#16a34a',
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Lead ↔ Category mapping (many-to-many)
CREATE TABLE IF NOT EXISTS lead_category_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES lead_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, category_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_categories_active ON lead_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_cat_map_lead ON lead_category_map(lead_id);
CREATE INDEX IF NOT EXISTS idx_cat_map_category ON lead_category_map(category_id);

-- 4. RLS
ALTER TABLE lead_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_category_map ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "categories_read" ON lead_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can create/edit/delete categories
CREATE POLICY "categories_admin_write" ON lead_categories
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Everyone can read mapping
CREATE POLICY "cat_map_read" ON lead_category_map
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin can manage all mappings
CREATE POLICY "cat_map_admin" ON lead_category_map
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Employee can manage mappings for their own leads
CREATE POLICY "cat_map_employee" ON lead_category_map
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_category_map.lead_id
        AND l.assigned_to = auth.uid()
    )
  );

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lead_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_category_map;

-- 6. Trigger
CREATE TRIGGER cat_updated_at BEFORE UPDATE ON lead_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Seed some default categories (optional - admin can delete/edit)
INSERT INTO lead_categories (name, color, description, sort_order) VALUES
  ('School Group',   '#3b82f6', 'School trips aur educational tours', 1),
  ('Corporate',      '#8b5cf6', 'Company events aur corporate trips', 2),
  ('Honeymoon',      '#ec4899', 'Newly married couples', 3),
  ('Family Trip',    '#f59e0b', 'Family vacation packages', 4),
  ('Solo Traveler',  '#14b8a6', 'Akele travel karne wale', 5),
  ('Custom Package', '#6366f1', 'Special customized packages', 6)
ON CONFLICT DO NOTHING;

SELECT 'Categories SQL done!' AS status;

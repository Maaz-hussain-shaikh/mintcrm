-- ============================================================
-- NOTIFICATION FIX — Run this in Supabase SQL Editor
-- Ye fix karta hai follow-up notifications ko
-- ============================================================

-- 1. Purana trigger hatao
DROP TRIGGER IF EXISTS lead_follow_up_notification ON leads;
DROP FUNCTION IF EXISTS create_follow_up_notification();

-- 2. Fixed notification function
CREATE OR REPLACE FUNCTION create_follow_up_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sirf tab notification banao jab follow_up_at set ya change ho
  IF NEW.follow_up_at IS NOT NULL AND (
    OLD.follow_up_at IS NULL OR
    OLD.follow_up_at IS DISTINCT FROM NEW.follow_up_at
  ) THEN
    -- Pehle purani unread notification delete karo same lead ki
    DELETE FROM notifications
    WHERE lead_id = NEW.id
      AND notification_type = 'follow_up'
      AND is_read = false;

    -- Naya notification banao
    INSERT INTO notifications (
      user_id,
      lead_id,
      title,
      message,
      notification_type,
      scheduled_at,
      is_read
    )
    VALUES (
      COALESCE(NEW.assigned_to, NEW.created_by),
      NEW.id,
      'Follow-up Reminder 🔔',
      'Follow up karo ' || NEW.name || ' ke saath' ||
        CASE WHEN NEW.trip_interest IS NOT NULL
          THEN ' (' || NEW.trip_interest || ')'
          ELSE ''
        END,
      'follow_up',
      NEW.follow_up_at,
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Trigger dobara lagao
CREATE TRIGGER lead_follow_up_notification
  AFTER INSERT OR UPDATE OF follow_up_at ON leads
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_up_notification();

-- 4. Confirm
SELECT 'Notification trigger fixed!' AS status;

-- ============================================================
-- OPTIONAL: Test karo — manually ek test notification banao
-- apni user ID daalo neeche
-- ============================================================
-- INSERT INTO notifications (user_id, title, message, notification_type, scheduled_at)
-- VALUES (
--   'YOUR-USER-ID-HERE',
--   'Test Notification',
--   'Ye ek test hai — notifications kaam kar rahi hain!',
--   'test',
--   NOW()
-- );

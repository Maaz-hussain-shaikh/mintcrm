-- ============================================================
-- SIGNUP FIX — Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Pehle purana trigger hatao
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 2: Naya fixed function banao
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Role safely set karo, default employee
  BEGIN
    user_role_val := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'employee'::user_role
    );
  EXCEPTION WHEN OTHERS THEN
    user_role_val := 'employee'::user_role;
  END;

  -- Profile insert karo
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    user_role_val,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Signup fail mat karo even if profile insert fails
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Step 3: Trigger dobara lagao
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 4: Confirm karo sab theek hai
SELECT 'Trigger fixed successfully!' AS status;

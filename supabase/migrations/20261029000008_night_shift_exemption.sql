-- ============================================================
-- Night shift requirement exemption
-- ============================================================
-- Employees must offer at least one night shift a week when submitting
-- availability (enforced by the app). Admins can exempt individual users.
-- Run after 20261029000007.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exempt_from_night_shift BOOLEAN NOT NULL DEFAULT false;

-- Only admins may change roles, blocked status or the exemption from the
-- API, so employees can't exempt themselves. The SQL Editor and the
-- service role are not limited.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
      OR NEW.exempt_from_night_shift IS DISTINCT FROM OLD.exempt_from_night_shift)
     AND current_user IN ('anon', 'authenticated')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles, blocked status or exemptions';
  END IF;
  RETURN NEW;
END;
$$;

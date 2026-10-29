-- ============================================================
-- Blocked users and shift statistics
-- ============================================================

-- ------------------------------------------------------------
-- 1. Blocking
-- ------------------------------------------------------------
-- The app refuses sign-in for blocked users and also bans them in Supabase
-- Auth, so existing sessions can't be refreshed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

-- A blocked admin loses admin rights immediately, even with a valid token.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin' AND NOT is_blocked
  );
$$;

-- Only admins may change roles or blocked status from the API. The SQL
-- Editor and the service role (used by the app's server) are not limited.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked)
     AND current_user IN ('anon', 'authenticated')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles or blocked status';
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. Statistics
-- ------------------------------------------------------------
-- Per-employee totals for a date range, aggregated in the database so large
-- ranges aren't cut off by the API's row limit. Weeks start on Sunday,
-- matching WEEK_STARTS_ON in src/lib/schedule.ts.

CREATE OR REPLACE FUNCTION public.shift_stats(p_from DATE, p_to DATE)
RETURNS TABLE (
  employee_id UUID,
  total_shifts INTEGER,
  night_shifts INTEGER,
  submitted_weeks INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can view statistics';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    (SELECT COUNT(*) FROM public.shift_assignments a
      WHERE a.employee_id = p.id AND a.shift_date BETWEEN p_from AND p_to)::INTEGER,
    (SELECT COUNT(*) FROM public.shift_assignments a
      WHERE a.employee_id = p.id AND a.shift_type = 'night'
        AND a.shift_date BETWEEN p_from AND p_to)::INTEGER,
    (SELECT COUNT(DISTINCT v.shift_date - EXTRACT(DOW FROM v.shift_date)::INTEGER)
      FROM public.shift_availabilities v
      WHERE v.employee_id = p.id AND v.shift_date BETWEEN p_from AND p_to)::INTEGER
  FROM public.profiles p
  WHERE p.role = 'employee';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.shift_stats(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_stats(DATE, DATE) TO authenticated;

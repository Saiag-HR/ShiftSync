-- ============================================================
-- Helpers
-- ============================================================

-- SECURITY DEFINER so policies can check the caller's role without
-- going through RLS on profiles (which would otherwise recurse).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- Create a profile automatically when a user signs up
-- ============================================================

-- Role is always 'employee' here; never read it from user metadata,
-- since the client controls that on sign-up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      SPLIT_PART(NEW.email, '@', 1),
      ''
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users who signed up before this migration.
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(u.email, '@', 1),
    ''
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- ============================================================
-- Prevent non-admins from changing roles
-- ============================================================

-- Applies only to API requests (anon/authenticated). The SQL Editor and
-- the service role can still set roles, e.g. to promote the first admin.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- ============================================================
-- shift_assignments: fill created_by and bump updated_at
-- ============================================================

ALTER TABLE public.shift_assignments
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_shift_assignments_updated_at
  BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- profiles: everyone signed in can see names (needed to show the schedule).
-- Users edit their own profile; admins edit any. Inserts come from the
-- sign-up trigger, deletes cascade from auth.users.
CREATE POLICY "Signed-in users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- shift_availabilities: employees manage only their own; admins see and manage all.
CREATE POLICY "View own availability or all as admin"
  ON public.shift_availabilities FOR SELECT
  TO authenticated
  USING (employee_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Add own availability or any as admin"
  ON public.shift_availabilities FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Update own availability or any as admin"
  ON public.shift_availabilities FOR UPDATE
  TO authenticated
  USING (employee_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (employee_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Delete own availability or any as admin"
  ON public.shift_availabilities FOR DELETE
  TO authenticated
  USING (employee_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- shift_assignments: everyone signed in can view the schedule; only admins change it.
CREATE POLICY "Signed-in users can view assignments"
  ON public.shift_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create assignments"
  ON public.shift_assignments FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update assignments"
  ON public.shift_assignments FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete assignments"
  ON public.shift_assignments FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));
